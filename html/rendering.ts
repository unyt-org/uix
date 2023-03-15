import { getCallerFile } from "unyt_core/utils/caller_metadata.ts";
import { Path } from "unyt_node/path.ts";
import { $$, Datex } from "unyt_core";
import { UIX } from "../uix.ts";
import { logger } from "../uix_all.ts";
import { IS_HEADLESS } from "../utils/constants.ts";
import { indent } from "../utils/indent.ts";

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

/**
 * serve a string/ArrayBuffer with a specific mime type
 * @param content 'file' content
 * @param type mime type
 * @returns content blob
 */
export async function provideContent(content:string|ArrayBuffer, type:mime_type = "text/plain", status?:number) {
	const blob = new Blob([content], {type});
	await Datex.Runtime.cacheValue(blob);
	if (status != undefined) blob._http_status = status;
	return blob;
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
export interface RoutingSink {
	resolveRoute(parts:string[]): string[]|Promise<string[]> // return part of route that could be resolved
	getInternalRoute(): string[]|Promise<string[]> // return internal state of last resolved route
}

/**
 * redirects to other Entrypoints for specific routes
 */
export interface RoutingAdapter {
	getRoute(parts:string[]): Entrypoint|Promise<Entrypoint> // return child entrypoint for route
}


export class FileProvider implements RoutingAdapter {

	#path: Path

	constructor(path:string|URL) {
		this.#path = new Path(path, getCallerFile());
		if (this.#path.fs_is_dir) this.#path = this.#path.asDir()
	}

	async getRoute(parts:string[]) {
		const path = this.#path.getChildPath(parts.join("/"));
		if (!path.fs_exists) return provideError("File not found", 404);
		else return renderStatic(await datex.get<Entrypoint>(path))
	}
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
export type raw_content = Blob
export type html_content = Datex.CompatValue<HTMLElement|string|number|boolean|bigint|Datex.Markdown|RoutingSink|RoutingAdapter>|null|raw_content;
export type html_content_or_generator = html_content|((ctx:UIX.Context)=>html_content|RenderPreset<RenderMethod, html_content>|Promise<html_content|RenderPreset<RenderMethod, html_content>>);
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


export async function collapseToContent<T extends Entrypoint, P extends string>(content:T|undefined, path?:P, context?:UIX.ContextGenerator|UIX.Context, only_return_static_content = false): Promise<[get_content<T, P>, get_render_method<T,P>, boolean]> {
	
	context ??= new UIX.Context()

	let collapsed:unknown;
	let render_method:RenderMethod = RenderMethod.HYDRATION;
	let loaded = false;

	if (only_return_static_content && content && content.__render_method == RenderMethod.DYNAMIC) collapsed = "";

	// handle generator functions
	else if (typeof content == "function") {
		if (typeof context == "function") context = context();
		[collapsed, render_method, loaded] = await collapseToContent(await content(context!), path, context, only_return_static_content)
	}
	// handle presets
	else if (content instanceof RenderPreset || (content && typeof content == "object" && !(content instanceof HTMLElement) && '__content' in content)) {
		[collapsed, render_method, loaded] = await collapseToContent(<html_content_or_generator>await content.__content, path, context, only_return_static_content);
		render_method = <RenderMethod> content.__render_method;
	}

	// routing adapter
	else if (typeof content?.getRoute == "function") {
		[collapsed, render_method, loaded] = await collapseToContent(await content.getRoute(path.replace(/^\//,'').split("/")), path, context, only_return_static_content)
	}
	
	// path object
	else if (!(content instanceof HTMLElement || content instanceof Datex.Markdown) && content && typeof content == "object" && Object.getPrototypeOf(content) == Object.prototype) {
		// find longest matching route
		let closest_match = null;

		let normalized_path = path;
		// // remove trailing /
		// if (normalized_path?.endsWith("/")) normalized_path = normalized_path.slice(0,-1)
		// add leading /
		if (typeof normalized_path == "string" && !normalized_path.startsWith("/")) normalized_path = "/" + normalized_path;

		for (const route of Object.keys(content)) {
			let normalized_route = route;
			// remove trailing /
			if (normalized_route?.endsWith("/")) normalized_route = normalized_route.slice(0,-1)
			// add leading /
			if (!normalized_route?.startsWith("/")) normalized_route = "/" + normalized_route;


			// match beginning
			if (normalized_route.endsWith("*")) {
				normalized_route = normalized_route.slice(0,-1)
				if (normalized_path?.startsWith(normalized_route) && normalized_route.length-1 >= (closest_match?.length??-1)) closest_match = route;
				// console.log("match?",content,path, normalized_path,normalized_route,closest_match)
			}
			// exact match
			else {
				if (normalized_path == normalized_route && normalized_route.length >= (closest_match?.length??-1)) closest_match = route;
			}
		}
		
		if (closest_match!==null) {
			// @ts-ignore
			let val = <any> content.$ ? (<any>content.$)[closest_match] : (<EntrypointRouteMap>content)[closest_match];
			if (val instanceof Datex.Value && !(val instanceof Datex.Pointer && val.is_js_primitive)) val = val.val; // only keep primitive pointer references
			const new_path = path?.replace(closest_match.replace(/\*$/,""), "") || "/";
			[collapsed, render_method, loaded] = await collapseToContent(await val, new_path, context, only_return_static_content);
		} 
	}

	// collapsed content
	else collapsed = await content;

	// only load once in recursive calls when deepest level reached
	if (!loaded) {
		// preload in deno, TODO: better solution?
		if (IS_HEADLESS && content instanceof HTMLElement) {
			globalThis.document.body.append(content);
			// wait until create lifecycle finished
			if (content instanceof UIX.Components.Base) await content.created; 
		}

		// routing component?
		if (path && typeof collapsed?.resolveRoute == "function") {
			if (!await resolveRouteForRoutingSink(<RoutingSink> collapsed, path.replace(/^\//,'').split("/"))) {
				collapsed = null; // reset content, route could not be resolved
			}
		}

		loaded = true;
	}


	return [<get_content<T, P>>collapsed, <any>render_method, loaded];
}

/**
 * Resolve a route on a RoutingSink
 * @param routingSink RoutingSink impl
 * @param route array of route parts
 * @returns true if the route could be fully resolved
 */
async function resolveRouteForRoutingSink(routingSink: RoutingSink, route:string[]){
	if (route.length) {
		const valid_route_part = await routingSink.resolveRoute(route);

		// route could not be fully resolved on frontend, try to reload from backend
		if (route.join("/") !== valid_route_part.join("/")) {
			return false;
			// if (window.location) window.location.pathname = route.join("/")
			// logger.warn `invalid route "/${route.join("/")}" - redirected to "/${valid_route_part.join("/")}"`;
		}
		return true;
	}
	else return true;
}