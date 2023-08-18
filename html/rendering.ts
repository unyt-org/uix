import { Path } from "../utils/path.ts";
import { $$, Datex, constructor } from "unyt_core";
import { UIX } from "../uix.ts";
import { logger } from "../uix_all.ts";
import { URLMatch } from "../base/context.ts";
import { IS_HEADLESS } from "../utils/constants.ts";

import { CACHED_CONTENT, getOuterHTML } from "./render.ts";
import { HTTPStatus } from "./http-status.ts";
import { convertToWebPath } from "../app/utils.ts";
import { RenderPreset, RenderMethod } from "./render-methods.ts"


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
	)

function reconstructMatchedURLPart(input:string, partResult:URLPatternComponentResult) {
	for (const [name,val] of Object.entries(partResult.groups)) {
		input = input.replace(':'+name, val);
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


export async function resolveEntrypointRoute<T extends Entrypoint>(entrypoint:T|undefined, route?:Path.Route, context?:UIX.ContextGenerator|UIX.Context, only_return_static_content = false, return_first_routing_handler = false): Promise<[get_content<T>, get_render_method<T>, number, boolean, Path.Route|undefined]> {

	if (!context) {
		context = new UIX.Context()
		if (route) context.path = route.routename
	}
	route ??= Path.Route();

	let collapsed:unknown;
	let render_method:RenderMethod = RenderMethod.HYDRATION;
	let remaining_route:Path.Route|undefined = route;
	let loaded = false;
	let status_code = 200;


	if (only_return_static_content && entrypoint && (<any> entrypoint).__render_method == RenderMethod.DYNAMIC) {
		remaining_route = Path.Route("/");
		collapsed = "";
	}

	// handle generator functions (exclude class)
	else if (typeof entrypoint == "function" && !/^\s*class/.test(entrypoint.toString())) {
		if (typeof context == "function") context = context();
		
		let returnValue: Entrypoint|undefined;
		try {
			returnValue = await entrypoint(context!);
		}
		// return error as response with HTTPStatus error 500
		catch (e) {
			if (e instanceof HTTPStatus) returnValue = e;
			// TODO: fix instance check if transmitted via datex, currently just force converted to HTTPStatus
			else if (typeof e == "object" && "code" in e && "content" in e && Object.keys(e).length == 2) returnValue = new HTTPStatus(e.code, e.content);
			else returnValue = HTTPStatus.INTERNAL_SERVER_ERROR.with(e)
		}

		[collapsed, render_method, status_code, loaded, remaining_route] = await resolveEntrypointRoute(returnValue, route, context, only_return_static_content, return_first_routing_handler)
	}
	// handle presets
	else if (entrypoint instanceof RenderPreset || (entrypoint && typeof entrypoint == "object" && !(entrypoint instanceof Element) && '__content' in entrypoint)) {
		[collapsed, render_method, status_code, loaded, remaining_route] = await resolveEntrypointRoute(<html_content_or_generator>await entrypoint.__content, route, context, only_return_static_content, return_first_routing_handler);
		render_method = <RenderMethod> entrypoint.__render_method;
	}

	// routing adapter TODO: better checks for interfaces? (not just 'getRoute')
	// @ts-ignore
	else if (typeof entrypoint?.getRoute == "function") {
		if (typeof context == "function") context = context();
		const route2 = await (<RouteHandler>entrypoint).getRoute(route, context);
		route = Path.Route("/"); // route completely resolved by getRoute
		[collapsed, render_method, status_code, loaded, remaining_route] = await resolveEntrypointRoute(route2, route, context, only_return_static_content, return_first_routing_handler)
	}
	
	// path object, not element/markdown/special_content
	else if (!(entrypoint instanceof Element || entrypoint instanceof Datex.Markdown || entrypoint instanceof URL || (globalThis.Deno && entrypoint instanceof globalThis.Deno.FsFile)) && entrypoint && typeof entrypoint == "object" && Object.getPrototypeOf(entrypoint) == Object.prototype) {
		// find longest matching route
		let closest_match_key:string|null = null;
		let closest_match_route:Path.Route|null = null;

		const isBetterMatch = (potential_route_key: string) => {
			// compare length of current closest_match with potential_route, ignoring *
			if (!closest_match_route) return true;
			return potential_route_key.replace(/\*$/, '').length > closest_match_route.routename.replace(/\*$/, '').length
		}
		// if true, the remaing '*' child routes are resolved in the next layer
		let handle_children_separately = false;

		for (const potential_route_key of Object.keys(entrypoint)) {

			let matchWith = route;

			let urlPattern:URLPattern;
			// url with http - match with base origin
			if (potential_route_key.startsWith("http://") || potential_route_key.startsWith("https://")) {
				urlPattern = new URLPattern(potential_route_key);
				matchWith = new Path(route.routename, globalThis.location?.href??'http:///unknown')
			}
			// just match a generic route
			else {
				const [pathname, hash] = potential_route_key.split("#");
				urlPattern = new URLPattern({pathname, hash})
			}
			
			let match:URLPatternResult|null;
			if ((match=urlPattern.exec(matchWith.toString())) && isBetterMatch(potential_route_key)) {
				if (typeof context == "function") context = context();
				closest_match_key = potential_route_key;
				closest_match_route = Path.Route(reconstructMatchedURL(potential_route_key, match));
				// route ends with * -> allow child routes
				handle_children_separately = potential_route_key.endsWith("*");
		
				context.urlMatch = new URLMatch(match);
				context.match = match;	
			}

			// const potential_route = Path.Route(potential_route_key);

			// // match beginning
			// if (potential_route.routename.endsWith("*")) {
			// 	if (route.routename.startsWith(potential_route.routename.slice(0,-1)) && isBetterMatch(potential_route)) {
			// 		closest_match_route = potential_route;
			// 		closest_match_key = potential_route_key;
			// 	}
			// }
			// // exact match
			// else {
			// 	if (Path.routesAreEqual(route, potential_route) && isBetterMatch(potential_route)) {
			// 		closest_match_route = potential_route;
			// 		closest_match_key = potential_route_key;
			// 	}
			// }
		}
		
		if (closest_match_key!==null) {
			// @ts-ignore
			let val = <any> entrypoint.$ ? (<any>entrypoint.$)[closest_match_key] : (<EntrypointRouteMap>entrypoint)[closest_match_key];
			if (val instanceof Datex.Value && !(val instanceof Datex.Pointer && val.is_js_primitive)) val = val.val; // only keep primitive pointer references
			const new_path = closest_match_route ? Path.Route(route.routename.replace(closest_match_route.routename.replace(/\*$/,""), "") || "/") : Path.Route("/");
			[collapsed, render_method, status_code, loaded, remaining_route] = await resolveEntrypointRoute(await val, new_path, context, only_return_static_content, return_first_routing_handler);
			if (!handle_children_separately) remaining_route = Path.Route("/");
		} 
	}

	// collapsed content
	else {
		// non routing handler content
		collapsed = await entrypoint;

		// special content to raw
		// URL 
		if (collapsed instanceof URL) {
			collapsed = new Response(null, {
				status: 302,
				headers: new Headers({ location: convertToWebPath(collapsed) })
			})
		}
		else if (globalThis.Deno && collapsed instanceof Deno.FsFile) {
			collapsed = new Response(collapsed.readable)
		}


		// @ts-ignore TODO: is this if condition required? currently commented out, because paths are overriden incorrectly
		if (typeof collapsed?.resolveRoute !== "function") 
			remaining_route = Path.Route("/");
	}

	// only load once in recursive calls when deepest level reached
	if (!loaded) {
		// preload in deno, TODO: better solution?
		if (IS_HEADLESS && (entrypoint instanceof Element || entrypoint instanceof DocumentFragment)) {
			await preloadElementOnBackend(entrypoint)
		}

		// routing handler?
		// @ts-ignore
		if (return_first_routing_handler && typeof collapsed?.getInternalRoute == "function") {
			return [<get_content<T>>collapsed, <any>render_method, status_code, loaded, remaining_route];
		}

		// @ts-ignore
		else if (route && typeof collapsed?.resolveRoute == "function") {

			// wait until at least construct lifecycle finished
			if (entrypoint instanceof UIX.Components.Base) await entrypoint.constructed

			if (!await resolveRouteForRouteManager(<RouteManager> collapsed, route, context)) {
				collapsed = null; // reset content, route could not be resolved
			}
		}

		loaded = true;
	}


	// extract status code from HTTPStatus
	if (collapsed instanceof HTTPStatus) {
		status_code = collapsed.code;
		collapsed = collapsed.content;
	}

	return [<get_content<T>>collapsed, <any>render_method, status_code, loaded, remaining_route];
	
}


export async function preloadElementOnBackend(element:Element|DocumentFragment) {
	// preload in deno, TODO: better solution?
	if (IS_HEADLESS) {

		const promises = [];

		// fake dom append
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
		// load shadow root
		if ((element as Element).shadowRoot) promises.push(preloadElementOnBackend((element as Element).shadowRoot!))
		// load children
		for (const child of (element.childNodes as unknown as Element[])) {
			promises.push(preloadElementOnBackend(child));
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
	if (typeof context == "function") context = context();
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

	const [routing_handler, _render_method, _status_code, _loaded, remaining_route] = await resolveEntrypointRoute(entrypoint, route_path, context, false, true);
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