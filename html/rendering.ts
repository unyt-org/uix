import { getCallerFile } from "unyt_core/utils/caller_metadata.ts";
import { Path } from "unyt_node/path.ts";
import { $$, Datex } from "unyt_core";
import { UIX } from "../uix.ts";
import { logger } from "../uix_all.ts";
import { IS_HEADLESS } from "../utils/constants.ts";
import { indent } from "../utils/indent.ts";

import type { Cookie } from "https://deno.land/std@0.177.0/http/cookie.ts";
const { setCookie } = globalThis.Deno ? (await import("https://deno.land/std@0.177.0/http/cookie.ts")) : {setCookie:null};
const fileServer = globalThis.Deno ? (await import("https://deno.land/std@0.164.0/http/file_server.ts")) : null;


/**
 * Default: Server side prerendering, content hydration over DATEX
 * @param content HTML element or text content
 */
export function renderWithHydration<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.HYDRATION, T> {
	if (!IS_HEADLESS) logger.warn("render methods have no effects for components created on the client side (renderWithHydration)")
	return new RenderPreset(RenderMethod.HYDRATION, content)
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
		return provideContent(JSON.stringify(value, null, options?.formatted ? '    ' : undefined), options.type[0])
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
export interface RoutingHandler {
	resolveRoute(route:Path.Route, context:UIX.Context): Path.route_representation|Promise<Path.route_representation> // return part of route that could be resolved
	getInternalRoute(): Path.route_representation|Promise<Path.route_representation> // return internal state of last resolved route
}

/**
 * redirects to other Entrypoints for specific routes
 */
export interface RoutingAdapter {
	getRoute(route:Path.Route, context:UIX.Context): Entrypoint|Promise<Entrypoint> // return child entrypoint for route
}


export class FileProvider implements RoutingAdapter {

	#path: Path

	constructor(path:Path.representation) {
		this.#path = new Path(path, getCallerFile());
		if (this.#path.fs_is_dir) this.#path = this.#path.asDir()
	}

	getRoute(route:Path.Route, context: UIX.Context) {
		const path = this.#path.getChildPath(route);
		if (!path.fs_exists) return provideError("File not found", 404);
		if (!context.request) return provideError("Cannot serve file");
		else return fileServer!.serveFile(context.request, path.pathname);
	}
}


/**
 * transforms entrypoint content to a new entrypoint content
 */
export abstract class EntrypointProxy implements RoutingAdapter {

	#entrypoint: Entrypoint

	constructor(entrypoint: Entrypoint = null) {
		this.#entrypoint = entrypoint;
	}

	async getRoute(route:Path.Route, context: UIX.Context) {
		let entrypoint = this.#entrypoint;
		const intercepted = await this.intercept?.(route, context);
		if (intercepted != null) entrypoint = intercepted;
		const [content, render_method] = await resolveEntrypointRoute(entrypoint, route, context);
		return this.transform?.(content, render_method, route, context) ?? <any> new RenderPreset<RenderMethod, html_content_or_generator>(render_method, content);
	}

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
	constructor(public readonly __render_method:R, public readonly __content:T) {}
} 


// collapse RenderPreset, ... to HTML element or other content
export type raw_content = Blob|Response
export type html_content = Datex.CompatValue<HTMLElement|string|number|boolean|bigint|Datex.Markdown|RoutingHandler|RoutingAdapter>|null|raw_content;
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


export async function resolveEntrypointRoute<T extends Entrypoint>(entrypoint:T|undefined, route?:Path.Route, context?:UIX.ContextGenerator|UIX.Context, only_return_static_content = false): Promise<[get_content<T>, get_render_method<T>, boolean]> {
	
	context ??= new UIX.Context()
	route ??= Path.Route();

	let collapsed:unknown;
	let render_method:RenderMethod = RenderMethod.HYDRATION;
	let loaded = false;

	if (only_return_static_content && entrypoint && (<any> entrypoint).__render_method == RenderMethod.DYNAMIC) collapsed = "";

	// handle generator functions
	else if (typeof entrypoint == "function") {
		if (typeof context == "function") context = context();
		[collapsed, render_method, loaded] = await resolveEntrypointRoute(await entrypoint(context!), route, context, only_return_static_content)
	}
	// handle presets
	else if (entrypoint instanceof RenderPreset || (entrypoint && typeof entrypoint == "object" && !(entrypoint instanceof HTMLElement) && '__content' in entrypoint)) {
		[collapsed, render_method, loaded] = await resolveEntrypointRoute(<html_content_or_generator>await entrypoint.__content, route, context, only_return_static_content);
		render_method = <RenderMethod> entrypoint.__render_method;
	}

	// routing adapter TODO: better checks for interfaces? (not just 'getRoute')
	// @ts-ignore
	else if (typeof entrypoint?.getRoute == "function") {
		if (typeof context == "function") context = context();
		[collapsed, render_method, loaded] = await resolveEntrypointRoute(await (<RoutingAdapter>entrypoint).getRoute(route, context), route, context, only_return_static_content)
	}
	
	// path object
	else if (!(entrypoint instanceof HTMLElement || entrypoint instanceof Datex.Markdown) && entrypoint && typeof entrypoint == "object" && Object.getPrototypeOf(entrypoint) == Object.prototype) {
		// find longest matching route
		let closest_match_key:string|null = null;
		let closest_match_route:Path.Route|null = null;

		const isBetterMatch = (potential_route: Path.Route) => {
			// compare length of current closest_match with potential_route, ignoring *
			if (!closest_match_route) return true;
			return potential_route.routename.replace(/\*$/, '').length > closest_match_route.routename.replace(/\*$/, '').length
		}

		for (const potential_route_key of Object.keys(entrypoint)) {
			const potential_route = Path.Route(potential_route_key);

			// match beginning
			if (potential_route.routename.endsWith("*")) {
				if (route.routename.startsWith(potential_route.routename.slice(0,-1)) && isBetterMatch(potential_route)) {
					closest_match_route = potential_route;
					closest_match_key = potential_route_key;
				}
			}
			// exact match
			else {
				if (Path.routesAreEqual(route, potential_route) && isBetterMatch(potential_route)) {
					closest_match_route = potential_route;
					closest_match_key = potential_route_key;
				}
			}
		}
		
		if (closest_match_key!==null) {
			// @ts-ignore
			let val = <any> entrypoint.$ ? (<any>entrypoint.$)[closest_match_key] : (<EntrypointRouteMap>entrypoint)[closest_match_key];
			if (val instanceof Datex.Value && !(val instanceof Datex.Pointer && val.is_js_primitive)) val = val.val; // only keep primitive pointer references
			const new_path = Path.Route(route.routename.replace(closest_match_route!.routename.replace(/\*$/,""), "") || "/");
			[collapsed, render_method, loaded] = await resolveEntrypointRoute(await val, new_path, context, only_return_static_content);
		} 
	}

	// collapsed content
	else collapsed = await entrypoint;

	// only load once in recursive calls when deepest level reached
	if (!loaded) {
		// preload in deno, TODO: better solution?
		if (IS_HEADLESS && entrypoint instanceof HTMLElement) {
			globalThis.document.body.append(entrypoint);
			// wait until create lifecycle finished
			if (entrypoint instanceof UIX.Components.Base) await entrypoint.created; 
		}


		// routing component?
		// @ts-ignore
		if (route && typeof collapsed?.resolveRoute == "function") {

			// wait until at least construct lifecycle finished
			if (entrypoint instanceof UIX.Components.Base) await entrypoint.constructed

			if (!await resolveRouteForRoutingHandler(<RoutingHandler> collapsed, route, context)) {
				collapsed = null; // reset content, route could not be resolved
			}
		}

		loaded = true;
	}

	return [<get_content<T>>collapsed, <any>render_method, loaded];
}

/**
 * Resolve a route on a RoutingHandler
 * @param routingHandler RoutingHandler impl
 * @param route array of route parts
 * @param context UIX context
 * @returns true if the route could be fully resolved
 */
async function resolveRouteForRoutingHandler(routingHandler: RoutingHandler, route:Path.Route, context: UIX.Context|UIX.ContextGenerator) {
	if (typeof context == "function") context = context();
	const valid_route_part = <Path.route_representation> await Promise.race([
		routingHandler.resolveRoute(route, context),
		new Promise((_,reject) => setTimeout(()=>{
			reject(new Error("Routing Handler ("+routingHandler.constructor.name+") did not resolve after 5s. There is probably a deadlock somehere. This can for example happen in a Component when awaiting defer() in the onRoute() handler."))
		}, 5000))
	])
	return Path.routesAreEqual(route, valid_route_part);
}