import { Path } from "../utils/path.ts";
import { $$, Datex, constructor } from "unyt_core";
import { UIX } from "../uix.ts";
import { app, logger } from "../uix_all.ts";
import {evaluateFilter, filter} from "../routing/route-filter.ts";
import { IS_HEADLESS } from "../utils/constants.ts";
import { Entrypoint, EntrypointRouteMap, RouteHandler, RouteManager, html_content_or_generator, html_generator } from "./entrypoints.ts"

import { CACHED_CONTENT, getOuterHTML } from "./render.ts";
import { HTTPStatus } from "./http-status.ts";
import { convertToWebPath } from "../app/utils.ts";
import { RenderPreset, RenderMethod } from "./render-methods.ts"
import { client_type } from "unyt_core/utils/global_values.ts";
import { createErrorHTML } from "./errors.tsx";


// URLPattern polyfill
// @ts-ignore
if (!globalThis.URLPattern) { 
	await import("../lib/urlpattern-polyfill/index.js");
}




/**
 * Render the current state of the element as HTML and cache for SSR
 * @param content
 * @param render_method 
 * @returns 
 */
export async function createSnapshot<T extends Element|DocumentFragment>(content:T, render_method = RenderMethod.HYDRATION):Promise<T> {
	await preloadElementOnBackend(content);
	// @ts-ignore
	content[CACHED_CONTENT] = await getOuterHTML(content, {injectStandaloneJS:render_method!=RenderMethod.STATIC_NO_JS, lang:Datex.Runtime.ENV.LANG, includeShadowRoots: true});
	return content;
}



type match_path<C extends EntrypointRouteMap, P extends string & keyof C> = C[P];

type get_content<C extends Entrypoint, Path extends string = string> = 
	// if C is EntrypointRouteMap -> return object value
	C extends EntrypointRouteMap ? get_content<match_path<C,Path>> : (
		// if C is RenderPreset -> return RenderPreset.__content
		C extends RenderPreset<infer R, infer T> ? get_content<T> : (
			// else if C is generator function
			C extends (...args:unknown[])=>infer T ? (
				// if generator returns preset -> return RenderPreset.content
				T extends RenderPreset<infer R, infer T2> ? get_content<T2> :
				// else return generator return value
				T
			) :
			C
		)
	)

type get_render_method<C extends Entrypoint, Path extends string = string> = 
	// if C is EntrypointRouteMap -> get render method for property
	C extends EntrypointRouteMap ? get_render_method<match_path<C,Path>> : (
		// if C is RenderPreset -> return RenderPreset.__render_method
		C extends RenderPreset<infer R, infer T> ? R : (
			// else if C is generator function
			C extends (...args:unknown[])=>infer T ? (
				// if generator returns preset -> return RenderPreset.__render_method
				T extends RenderPreset<infer R, infer T2> ? R :
				// else return default RenderMethod.HYDRATION
				RenderMethod.HYDRATION
			) :
			RenderMethod.HYDRATION
		)
	);


type entrypointData<T extends Entrypoint = Entrypoint> = {
	entrypoint: T,
	route?:Path.Route, 
	context?:UIX.ContextGenerator|UIX.Context, 
	only_return_static_content?: boolean
	return_first_routing_handler?: boolean
}

type resolvedEntrypointData<T extends Entrypoint = Entrypoint> = {
	content: get_content<T>,
	render_method: UIX.RenderMethod, // get_render_method<T>, 
	status_code: number, 
	loaded: boolean, 
	remaining_route?: Path.Route
}

function reconstructMatchedURLPart(input:string, partResult:URLPatternComponentResult) {
	for (const [name,val] of Object.entries(partResult.groups)) {
		input = input.replace(':'+name, val??'');
	}
	return input
}

/**
 * replaces ':name' parts of url pattern with matched values to reconstruct a valid url (keeps *)
 * @param input 
 * @param match 
 * @returns 
 */
function reconstructMatchedURL(input:string, match:URLPatternResult) {
	input = reconstructMatchedURLPart(input, match.protocol);
	input = reconstructMatchedURLPart(input, match.username);
	input = reconstructMatchedURLPart(input, match.password);
	input = reconstructMatchedURLPart(input, match.hostname);
	input = reconstructMatchedURLPart(input, match.pathname);
	input = reconstructMatchedURLPart(input, match.hash);
	input = reconstructMatchedURLPart(input, match.search);
	return input
}

function resolveContext(entrypointData: entrypointData): asserts entrypointData is entrypointData & {context: UIX.Context} {
	if (typeof entrypointData.context == "function") entrypointData.context = entrypointData.context();
	if (!entrypointData.context) throw new Error("missing UIX context for generator function")
}

async function resolveGeneratorFunction(entrypointData: entrypointData<html_generator>): Promise<resolvedEntrypointData> {
	resolveContext(entrypointData)

	let returnValue: Entrypoint|undefined;
	let hasError = false;
	try {
		returnValue = await entrypointData.entrypoint(entrypointData.context, (entrypointData.context).params);
	}
	// return error as response with HTTPStatus error 500
	catch (e) {
		hasError = true;

		if (e instanceof Error) returnValue = e;
		else if (e instanceof HTTPStatus) returnValue = e;
		// TODO: fix instance check if transmitted via datex, currently just force converted to HTTPStatus
		else if (typeof e == "object" && "code" in e && "content" in e && Object.keys(e).length == 2) returnValue = new HTTPStatus(e.code, e.content);
		else {
			returnValue = HTTPStatus.INTERNAL_SERVER_ERROR.with(e)
		}
	}

	const resolved = await resolveEntrypointRoute({...entrypointData, entrypoint: returnValue})
	if (hasError) resolved.render_method = RenderMethod.STATIC; // override: render errors as static

	return resolved;
}

async function resolveRenderPreset(entrypointData: entrypointData<RenderPreset>): Promise<resolvedEntrypointData> {
	const content = await entrypointData.entrypoint.__content;
	const resolved = await resolveEntrypointRoute({...entrypointData, entrypoint: content});
	resolved.render_method = entrypointData.entrypoint.__render_method;
	return resolved;
}

async function resolveRouteHandler(entrypointData: entrypointData<RouteHandler>): Promise<resolvedEntrypointData> {
	resolveContext(entrypointData)
	if (!entrypointData.route) throw new Error("missing entrypoint route (required for RouteHandler")
	const route2 = await entrypointData.entrypoint.getRoute(entrypointData.route, entrypointData.context);
	entrypointData.route = Path.Route("/"); // route completely resolved by getRoute
	return resolveEntrypointRoute({...entrypointData, entrypoint: route2})
}

function resolveModule(entrypointData: entrypointData<{default?:Entrypoint}>): Promise<resolvedEntrypointData> {
	if (!entrypointData.entrypoint.default) throw new Error("invalid module as entrypoint: no default export")
	const content = entrypointData.entrypoint.default
	return resolveEntrypointRoute({...entrypointData, entrypoint: content});
}

function generateURLParamsObject(matches: URLPatternResult) {
	return new Proxy({} as Record<string,string>, {
		get(_, identifier) {
			if (typeof identifier=="symbol") {
				console.error("Issue here!", _, identifier)
				return undefined;
				//throw new Error("Invalid parameter key");
			}
			if (!matches) throw new Error("Missing URL parameter ':" + identifier + "'");
			for (const group of Object.values(matches)) {
				if (group.groups?.[identifier] != undefined) return group.groups[identifier];
			}
			throw new Error("Missing URL parameter ':" + identifier + "'");
		}
	})
}

async function resolvePathMap(entrypointData: entrypointData<EntrypointRouteMap>): Promise<resolvedEntrypointData|undefined> {
	resolveContext(entrypointData)

	// find longest matching route
	let closest_match_key:string|filter|null = null;
	let closest_match_route:Path.Route|null = null;

	const isBetterMatch = (potential_route_key: string) => {
		// compare length of current closest_match with potential_route, ignoring *
		if (!closest_match_route) return true;
		return potential_route_key.replace(/\*$/, '').length > closest_match_route.routename.replace(/\*$/, '').length
	}
	// if true, the remaing '*' child routes are resolved in the next layer
	let handle_children_separately = false;

	// handle symbol keys (request methods)
	let matchingSymbol = false;

	for (const potential_route_key of Object.keys(entrypointData.entrypoint)) {
		let matchWith = entrypointData.route!;

		let urlPattern:URLPattern;
		// url with http - match with base origin
		if (potential_route_key.startsWith("http://") || potential_route_key.startsWith("https://")) {
			urlPattern = new URLPattern(potential_route_key);
			matchWith = new Path(entrypointData.route!.routename, globalThis.location?.href??'http:///unknown')
		}
		// just match a generic route
		else {
			let normalized_route_key = potential_route_key;
			if (!potential_route_key.startsWith("/")) normalized_route_key = "/" + potential_route_key
			const [pathname, hash] = normalized_route_key.split("#");
			urlPattern = new URLPattern({pathname, hash})
		}
		
		let match:URLPatternResult|null;
		if ((match=urlPattern.exec(matchWith.toString())) && isBetterMatch(potential_route_key)) {
			closest_match_key = potential_route_key;
			closest_match_route = Path.Route(reconstructMatchedURL(potential_route_key, match));
			// route ends with * -> allow child routes
			handle_children_separately = potential_route_key.endsWith("*");
	
			entrypointData.context.params = generateURLParamsObject(match);
			entrypointData.context.urlPattern = match;	
		}
	}
	

	// check symbols if no match key found, or only default wildcard
	if (closest_match_key==null || closest_match_key == "*") {
		for (const symbolKey of Object.getOwnPropertySymbols(entrypointData.entrypoint)) {
			if (await evaluateFilter(symbolKey as filter, entrypointData.context)) {
				matchingSymbol = true;
				closest_match_key = symbolKey as filter;
				break;
			}
		}
	}
	
	
	if (closest_match_key!==null) {
		let val = <any> entrypointData.entrypoint.$ ? (<any>entrypointData.entrypoint.$)[closest_match_key] : (<EntrypointRouteMap>entrypointData.entrypoint)[closest_match_key];
		if (val instanceof Datex.Ref && !(val instanceof Datex.Pointer && val.is_js_primitive)) val = val.val; // only keep primitive pointer references
		val = await val;
		// only update route if a string key, symbol keys don't mutate the route
		const new_path = matchingSymbol ? entrypointData.route : closest_match_route ? Path.Route(entrypointData.route!.routename.replace(closest_match_route.routename.replace(/\*$/,""), "") || "/") : Path.Route("/");
		
		const resolved = await resolveEntrypointRoute({...entrypointData, entrypoint: val, route: new_path});
		if (!handle_children_separately) resolved.remaining_route = Path.Route("/");
		return resolved;
	} 
	else {
		// pass through if nothing found
		return {
			status_code: 200,
			content: null,
			loaded: true,
			render_method: RenderMethod.DYNAMIC
		}
	}
}


export async function resolveEntrypointRoute<T extends Entrypoint>(entrypointData: entrypointData<T>): Promise<resolvedEntrypointData<Entrypoint>> {

	// init context if missing
	if (!entrypointData.context) {
		entrypointData.context = new UIX.Context()
		if (entrypointData.route) entrypointData.context.path = entrypointData.route.routename
	}
	// init route if missing
	entrypointData.route ??= Path.Route();

	// make sure entrypoint Promise is awaited
	entrypointData.entrypoint = await entrypointData.entrypoint;

	let resolved: resolvedEntrypointData = {
		content: undefined,
		render_method: RenderMethod.HYDRATION,
		remaining_route: entrypointData.route,
		loaded: false,
		status_code: 200
	}

	// handle only return static
	if (entrypointData.only_return_static_content && entrypointData.entrypoint && (<any> entrypointData.entrypoint).__render_method == RenderMethod.DYNAMIC) {
		resolved.remaining_route = Path.Route("/");
		resolved.content = "";
	}

	// handle generator functions (exclude class)
	else if (typeof entrypointData.entrypoint == "function" && !/^\s*class/.test(entrypointData.entrypoint.toString())) {
		resolved = await resolveGeneratorFunction(entrypointData as entrypointData<html_generator>);
	}

	// handle render presets
	else if (entrypointData.entrypoint instanceof RenderPreset || (entrypointData.entrypoint && typeof entrypointData.entrypoint == "object" && !(entrypointData.entrypoint instanceof Element) && '__content' in entrypointData.entrypoint)) {
		resolved = await resolveRenderPreset(entrypointData as entrypointData<RenderPreset>);
	}

	// handle RouteHandler TODO: better checks for interfaces? (not just 'getRoute')
	else if (typeof (entrypointData.entrypoint as any)?.getRoute == "function") {
		resolved = await resolveRouteHandler(entrypointData as entrypointData<RouteHandler>);
	}

	// handle FsFile
	else if (globalThis.Deno && entrypointData.entrypoint instanceof Deno.FsFile) {
		resolved.content = new Response(entrypointData.entrypoint.readable)
	}

	// handle status code from HTTPStatus
	else if (entrypointData.entrypoint instanceof HTTPStatus) {
		resolved.status_code = entrypointData.entrypoint.code;
		resolved.content = entrypointData.entrypoint.content;
	}

	// await Promise
	else if (entrypointData.entrypoint instanceof Promise) {
		resolved.content = await entrypointData.entrypoint;
	}
	
	// handle path object, not element/markdown/special_content
	else if (!(entrypointData.entrypoint instanceof Element || entrypointData.entrypoint instanceof Datex.Markdown || entrypointData.entrypoint instanceof URL || (globalThis.Deno && entrypointData.entrypoint instanceof globalThis.Deno.FsFile)) && entrypointData.entrypoint && typeof entrypointData.entrypoint == "object" && Object.getPrototypeOf(entrypointData.entrypoint) == Object.prototype) {
		resolved = await resolvePathMap(entrypointData as entrypointData<EntrypointRouteMap>) ?? resolved;
	}

	// handle module (prototype null) - get default value
	else if (typeof entrypointData.entrypoint == "object" && entrypointData.entrypoint && Object.getPrototypeOf(entrypointData.entrypoint) == null) {
		resolved = await resolveModule(entrypointData as entrypointData<{default?:Entrypoint}>);
	}

	// handle URL
	else if (entrypointData.entrypoint instanceof URL) {
		resolved.content = new Response(null, {
			status: 302,
			headers: new Headers({ location: convertToWebPath(entrypointData.entrypoint) })
		})
	}

	// handle Error
	else if (entrypointData.entrypoint instanceof Error) {
		const [statusCode, html] = createErrorHTML('Routing failed', entrypointData.entrypoint);
		resolved.content = html;
		resolved.status_code = statusCode;
	}
	

	// else just return current entrypoint
	else {
		resolved.content = entrypointData.entrypoint
		// if (entrypointData.entrypoint != null) {
			
		// }
		// else {
		// 	resolved = {
		// 		status_code: 404,
		// 		content: "No Content",
		// 		loaded: true,
		// 		render_method: RenderMethod.RAW_CONTENT
		// 	}
		// }
		
		
	}

	// @ts-ignore TODO: is this if condition required? currently commented out, because paths are overriden incorrectly
	// if (typeof entrypointData.entrypoint?.resolveRoute !== "function") 
	// 	resolved.remaining_route = Path.Route("/");

	// only load once in recursive calls when deepest level reached
	if (!resolved.loaded) {
		// preload in deno, TODO: better solution?
		if (IS_HEADLESS && (entrypointData.entrypoint instanceof Element || entrypointData.entrypoint instanceof DocumentFragment)) {
			await preloadElementOnBackend(entrypointData.entrypoint)
		}

		// routing handler?
		// @ts-ignore
		if (entrypointData.return_first_routing_handler && typeof resolved.content?.getInternalRoute == "function") {
			// return [<get_content<T>>collapsed, <any>render_method, status_code, loaded, remaining_route];
		}

		// @ts-ignore
		else if (entrypointData.route && typeof resolved.content?.resolveRoute == "function") {

			// wait until at least construct lifecycle finished
			if (entrypointData.entrypoint instanceof UIX.Components.Base) await entrypointData.entrypoint.constructed

			if (!await resolveRouteForRouteManager(resolved.content as RouteManager, entrypointData.route, entrypointData.context)) {
				resolved.content = null; // reset content, route could not be resolved
			}
		}

		resolved.loaded = true;
	}

	return resolved;
}


export async function preloadElementOnBackend(element:Element|DocumentFragment, parent?:Element|DocumentFragment) {
	// preload in deno, TODO: better solution?
	if (IS_HEADLESS) {

		const promises = [];

		// fake dom append for UIX Component
		if (element instanceof UIX.UIXComponent || element instanceof UIX.Components.Base) {
			let resolved = false;
			const timeoutSec = `${(element.CREATE_TIMEOUT/1000)}s`
			await Promise.race([
				element.connectedCallback(),
				element.created,
				new Promise<void>(resolve=>setTimeout(()=>{
					if (!resolved) {
						logger.error("onCreate() method of "+element.constructor.name+" has not resolved after "+timeoutSec+", generating static snapshot for available state. Increase the CREATE_TIMEOUT for this component if the onCreate method is supposed to take longer than "+timeoutSec+".");
						resolve()
					}
				},element.CREATE_TIMEOUT))
			])
			resolved = true;
		}
		
		// fake dom append for other elements with connectedCallback (e.g light-root)
		else if (typeof (element as any).connectedCallback == "function") {
			(element as any).connectedCallback();
		}

		// load shadow root
		if ((element as Element).shadowRoot) promises.push(preloadElementOnBackend((element as Element).shadowRoot!, element))
		// load children
		for (const child of (element.childNodes as unknown as Element[])) {
			promises.push(preloadElementOnBackend(child, element));
		}

		await Promise.all(promises)
	}
}

/**
 * Resolve a route on a RouteManager
 * @param routeManager RouteManager impl
 * @param route array of route parts
 * @param context UIX context
 * @returns true if the route could be fully resolved
 */
async function resolveRouteForRouteManager(routeManager: RouteManager, route:Path.Route, context: UIX.Context|UIX.ContextGenerator) {
	if (typeof context == "function") context = await context();
	const valid_route_part = <Path.route_representation> await Promise.race([
		routeManager.resolveRoute(route, context),
		new Promise((_,reject) => setTimeout(()=>{
			reject(new Error("Route Manager ("+routeManager.constructor.name+") did not resolve after 5s. There is probably a deadlock somehere. This can for example happen in a Component when awaiting defer() in the onRoute() handler."))
		}, 5000))
	])
	return Path.routesAreEqual(route, valid_route_part);
}

/**
 * gets the part of the route that is calculated without internal routing (RouteManager). 
 * Recalculate the current path from the inner Routing Handler if it exists
 * @param route 
 * @param entrypoint 
 * @param context 
 * @returns 
 */
export async function refetchRoute(route: Path.route_representation, entrypoint: Entrypoint, context?:UIX.Context) {
	const route_path = Path.Route(route);

	const {content: routing_handler, remaining_route} = await resolveEntrypointRoute({entrypoint, route: route_path, context, return_first_routing_handler: true});
	if (!remaining_route) throw new Error("could not reconstruct route " + route_path.routename);
	
	// valid part of route before potential RouteManager
	const existing_route = Path.Route(route_path.routename.replace(remaining_route.routename,""));
	
	// resolve internal route in RouteManager
	if (routing_handler?.getInternalRoute) {
		const combined_route = <Path.Route> existing_route.getChildRoute(Path.Route(await (<RouteManager>routing_handler).getInternalRoute()));
		return combined_route;
	}
	else return existing_route;
	
}