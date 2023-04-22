import { getCallerFile } from "unyt_core/utils/caller_metadata.ts";
import { Path } from "unyt_node/path.ts";
import { $$, Datex } from "unyt_core";
import { UIX } from "../uix.ts";
import { logger } from "../uix_all.ts";
import { IS_HEADLESS } from "../utils/constants.ts";
import { indent } from "../utils/indent.ts";

import type { Cookie } from "https://deno.land/std@0.177.0/http/cookie.ts";
import { DX_IGNORE } from "unyt_core/runtime/constants.ts";
import { CACHED_CONTENT, getOuterHTML } from "./render.ts";

const { setCookie } = globalThis.Deno ? (await import("https://deno.land/std@0.177.0/http/cookie.ts")) : {setCookie:null};
const fileServer = globalThis.Deno ? (await import("https://deno.land/std@0.164.0/http/file_server.ts")) : null;


// URLPattern polyfill
// @ts-ignore
if (!globalThis.URLPattern) { 
	await import("../lib/urlpattern-polyfill/index.js");
}


/**
 * Default: Server side prerendering, content hydration over DATEX
 * @param content HTML element or text content
 */
export function renderWithHydration<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.HYDRATION, T> {
	if (!IS_HEADLESS) logger.warn("render methods have no effects for components created on the client side (renderWithHydration)")
	return new RenderPreset(RenderMethod.HYDRATION, content)
}

/**
 * Default: Server side prerendering, replacing with content on frontend
 * @param content HTML element or text content
 */
export function renderPreview<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.HYDRATION, T> {
	if (!IS_HEADLESS) logger.warn("render methods have no effects for components created on the client side (renderPreview)")
	const preset = new RenderPreset(RenderMethod.HYDRATION, content)
	// @ts-ignore
	preset[DX_IGNORE] = true;
	return preset
}


/**
 * Just serve static HTML pages to the frontend, + some frontend JS for functionality,
 * but content is not loaded over DATEX
 * @param content HTML element or text content
 */
export function renderStatic<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.STATIC, T> {
	if (!IS_HEADLESS) logger.warn("render methods have no effects for components created on the client side (renderStatic)")
	return new RenderPreset(RenderMethod.STATIC, content)
}

/**
 * Just serve static HTML pages to the frontend, no frontend JS at all
 * @param content HTML element or text content
 */
export function renderStaticWithoutJS<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.STATIC_NO_JS, T> {
	if (!IS_HEADLESS) logger.warn("render methods have no effects for components created on the client side (renderStaticWithoutJS)")
	return new RenderPreset(RenderMethod.STATIC_NO_JS, content)
}

/**
 * No server side prerendering, loading all content over DATEX
 * @param content HTML element or text content
 */
export function renderDynamic<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.DYNAMIC, T> {
	if (!IS_HEADLESS) logger.warn("render methods have no effects for components created on the client side (renderDynamic)")
	return new RenderPreset(RenderMethod.DYNAMIC, content)
}


export function once<T extends html_generator>(generator: T): T {
	let result:Awaited<ReturnType<T>>|undefined;
	let loaded = false;
	return <any> (async function(ctx: UIX.Context) {
		if (loaded) return result;
		else {
			result = <any> await generator(ctx);
			loaded = true;
			return result;
		}
	})
}


/**
 * serve a value as raw content (DX, DXB, JSON format)
 * @param value any JS value (must be JSON compatible if JSON is used as the content type)
 * @param options optional options:
 * 	type: Datex.FILE_TYPE (DX, DXB, JSON)
 *  formatted: boolean if true, the DX/JSON is formatted with newlines/spaces
 * @returns blob containing DATEX/JSON encoded value
 */
export async function provideValue(value:unknown, options?:{type?:Datex.DATEX_FILE_TYPE, formatted?:boolean}) {
	if (options?.type == Datex.FILE_TYPE.DATEX_BINARY) {
		return provideContent(<ArrayBuffer> await Datex.Compiler.compile("?", [value]), options.type[0])
	}
	else if (options?.type == Datex.FILE_TYPE.JSON) {
		return provideContent(JSON.stringify(value??null, null, options?.formatted ? '    ' : undefined), options.type[0])
	}
	else {
		return provideContent(Datex.Runtime.valueToDatexStringExperimental(value, options?.formatted), (options?.type ?? Datex.FILE_TYPE.DATEX_SCRIPT)[0])
	}
}


export function provideResponse(content:ReadableStream | XMLHttpRequestBodyInit, type:mime_type, status = 200, cookies?:Cookie[], headers:Record<string, string> = {}, cors = false) {
	if (cors) Object.assign(headers, {"Content-Type": type, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"});
	const res = new Response(content, {headers, status});
	if (cookies) {
		for (const cookie of cookies) setCookie!(res.headers, cookie);
	}
	return res;
}

/**
 * serve a string/ArrayBuffer with a specific mime type
 * @param content 'file' content
 * @param type mime type
 * @returns content blob
 */
export async function provideContent(content:string|ArrayBuffer, type:mime_type = "text/plain;charset=utf-8", status?:number) {
	const blob = new Blob([content], {type});
	await Datex.Runtime.cacheValue(blob);
	return provideResponse(blob, type, status);
}

/**
 * serve an errror with a status code and message
 * @param message error message
 * @param status http status code
 * @returns content blob
 */
export function provideError(message: string, status = 500) {
	const content = indent `
	<html>
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
		</head>
	
		<body>
			<div style="
				width: 100%;
				height: 100%;
				display: flex;
				justify-content: center;
				align-items: center;
				font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
				font-size: 1.5em;
				color: var(--text_highlight);">
				<div>
					<h2 style="margin-bottom:0">Error</h2>
					<div>${message}</div>
				</div>
			</div>
		</body>
	</html>
	`;
	return provideContent(content, "text/html", status);
}

/**
 * handles routes internally
 */
export interface RouteManager {
	resolveRoute(route:Path.Route, context:UIX.Context): Path.route_representation|Promise<Path.route_representation> // return part of route that could be resolved
	getInternalRoute(): Path.route_representation|Promise<Path.route_representation> // return internal state of last resolved route
}

/**
 * redirects to other Entrypoints for specific routes
 */
export interface RouteHandler {
	getRoute(route:Path.Route, context:UIX.Context): Entrypoint|Promise<Entrypoint> // return child entrypoint for route
}


export class FileProvider implements RouteHandler {

	#path: Path

	get path() {return this.#path}

	constructor(path:Path.representation) {
		this.#path = new Path(path, getCallerFile());
		if (this.#path.fs_is_dir) this.#path = this.#path.asDir()
	}

	getRoute(route:Path.route_representation|string, context: UIX.Context) {
		const path = this.#path.getChildPath(route);
		if (!path.fs_exists) return provideError("File not found", 404);
		if (!context.request) return provideError("Cannot serve file");
		else return fileServer!.serveFile(context.request, path.normal_pathname);
	}
}


/**
 * transforms entrypoint content to a new entrypoint content
 */
export abstract class EntrypointProxy<E extends Entrypoint = Entrypoint> implements RouteHandler {

	#entrypoint: E
	get entrypoint() {return this.#entrypoint}

	constructor(entrypoint: E = null) {
		this.#entrypoint = entrypoint;
	}

	async getRoute(route:Path.Route, context: UIX.Context) {
		let entrypoint = this.#entrypoint;
		route = Path.Route(await this.redirect?.(route, context) ?? route);
		const intercepted = await this.intercept?.(route, context);
		if (intercepted != null) entrypoint = intercepted;
		const [content, render_method] = await resolveEntrypointRoute(entrypoint, route, context);
		return this.transform?.(content, render_method, route, context) ?? <any> new RenderPreset<RenderMethod, html_content_or_generator>(render_method, content);
	}

	/**
	 * This method is called before intercept()
	 * It can be used to modify the route that is used by the intercept method and the entrypoint
	 * 
	 * The returned value replaces the current route part
	 * 
	 * @param route requested route
	 * @param context UIX context
	 * @returns new route or void
	 */
	abstract redirect?(route:Path.Route, context: UIX.Context): void|Path.route_representation|string|null|Promise<void|Path.route_representation|string|null>

	/**
	 * This method is called before a route is resolved by the entrypoint
	 * It can be used to implement a custom routing behaviour
	 * for some or all routes, overriding the entrypoint routing
	 * 
	 * The returned value replaces the entrypoint, if not null
	 * 
	 * @param route requested route
	 * @param context UIX context
	 * @returns entrypoint override or null
	 */
	abstract intercept?(route:Path.Route, context: UIX.Context): void|Entrypoint|Promise<void|Entrypoint>

	/**
	 * This method is called after a route was resolved by the entrypoint
	 * It can be used to override the content provided for a route by returning 
	 * a different entrypoint value. 
	 * When null is returned, the route content is not changed
	 * 
	 * @param content content as resolved by entrypoint
	 * @param render_method render method as resolved by entrypoint
	 * @param route the requested route
	 * @param context UIX context
	 * @returns entrypoint override or null
	 */
	abstract transform?(content: Entrypoint, render_method: RenderMethod, route:Path.Route, context: UIX.Context): void|Entrypoint|Promise<void|Entrypoint>
}


type mime_type = `${'text'|'image'|'application'|'video'|'audio'}/${string}`;

export enum RenderMethod {
	HYDRATION, // Server side prerendering, content hydration over DATEX
	STATIC, // Just serve static HTML pages to the frontend, + some frontend JS for functionality
	STATIC_NO_JS, // Just serve static HTML pages to the frontend, no frontend JS at all
	DYNAMIC, // No server side prerendering, loading all content over DATEX
	RAW_CONTENT, // Serve raw file content
}

export class RenderPreset<R extends RenderMethod,T extends html_content_or_generator> {
	constructor(public readonly __render_method:R, public readonly __content:T) {
		// don't transmit from backend to frontend via DATEX if static
		if (this.__render_method == RenderMethod.STATIC || this.__render_method == RenderMethod.STATIC_NO_JS) {
			// @ts-ignore
			this[DX_IGNORE] = true;
		}
	}
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


// collapse RenderPreset, ... to HTML element or other content
export type raw_content = Blob|Response
export type html_content = Datex.CompatValue<Element|string|number|boolean|bigint|Datex.Markdown|RouteManager|RouteHandler>|null|raw_content;
export type html_generator = (ctx:UIX.Context)=>html_content|RenderPreset<RenderMethod, html_content>|Promise<html_content|RenderPreset<RenderMethod, html_content>>;
export type html_content_or_generator = html_content|html_generator;
export type html_content_or_generator_or_preset = html_content_or_generator|RenderPreset<RenderMethod, html_content_or_generator>;

export type EntrypointRouteMap = {[route:string]:Entrypoint}
type _Entrypoint = html_content_or_generator_or_preset | EntrypointRouteMap
export type Entrypoint = _Entrypoint | Promise<_Entrypoint>

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


export async function resolveEntrypointRoute<T extends Entrypoint>(entrypoint:T|undefined, route?:Path.Route, context?:UIX.ContextGenerator|UIX.Context, only_return_static_content = false, return_first_routing_handler = false): Promise<[get_content<T>, get_render_method<T>, boolean, Path.Route|undefined]> {
	
	if (!context) {
		context = new UIX.Context()
		if (route) context.path = route.routename
	}
	route ??= Path.Route();

	let collapsed:unknown;
	let render_method:RenderMethod = RenderMethod.HYDRATION;
	let remaining_route:Path.Route|undefined = route;
	let loaded = false;


	if (only_return_static_content && entrypoint && (<any> entrypoint).__render_method == RenderMethod.DYNAMIC) {
		remaining_route = Path.Route("/");
		collapsed = "";
	}

	// handle generator functions
	else if (typeof entrypoint == "function") {
		if (typeof context == "function") context = context();
		[collapsed, render_method, loaded, remaining_route] = await resolveEntrypointRoute(await entrypoint(context!), route, context, only_return_static_content, return_first_routing_handler)
	}
	// handle presets
	else if (entrypoint instanceof RenderPreset || (entrypoint && typeof entrypoint == "object" && !(entrypoint instanceof Element) && '__content' in entrypoint)) {
		[collapsed, render_method, loaded, remaining_route] = await resolveEntrypointRoute(<html_content_or_generator>await entrypoint.__content, route, context, only_return_static_content, return_first_routing_handler);
		render_method = <RenderMethod> entrypoint.__render_method;
	}

	// routing adapter TODO: better checks for interfaces? (not just 'getRoute')
	// @ts-ignore
	else if (typeof entrypoint?.getRoute == "function") {
		if (typeof context == "function") context = context();
		[collapsed, render_method, loaded, remaining_route] = await resolveEntrypointRoute(await (<RouteHandler>entrypoint).getRoute(route, context), route, context, only_return_static_content, return_first_routing_handler)
	}
	
	// path object
	else if (!(entrypoint instanceof Element || entrypoint instanceof Datex.Markdown) && entrypoint && typeof entrypoint == "object" && Object.getPrototypeOf(entrypoint) == Object.prototype) {
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
			[collapsed, render_method, loaded, remaining_route] = await resolveEntrypointRoute(await val, new_path, context, only_return_static_content, return_first_routing_handler);
			if (!handle_children_separately) remaining_route = Path.Route("/");
		} 
	}

	// collapsed content
	else {
		// non routing handler content
		collapsed = await entrypoint;
		// @ts-ignore
		if (typeof collapsed?.resolveRoute !== "function") remaining_route = Path.Route("/");
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
			return [<get_content<T>>collapsed, <any>render_method, loaded, remaining_route];
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

	return [<get_content<T>>collapsed, <any>render_method, loaded, remaining_route];
}


export async function preloadElementOnBackend(element:Element|DocumentFragment) {
	// preload in deno, TODO: better solution?
	if (IS_HEADLESS) {

		const promises = [];

		// fake dom append
		if (element instanceof UIX.BaseComponent || element instanceof UIX.Components.Base) {
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
	const [routing_handler, _render_method, _loaded, remaining_route] = await resolveEntrypointRoute(entrypoint, route_path, context, false, true);
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