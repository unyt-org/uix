import { Datex } from "unyt_core";
import { logger } from "../uix_all.ts";
import { IS_HEADLESS } from "../utils/constants.ts";

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



export enum RenderMethod {
	HYDRATION,
	STATIC,
	STATIC_NO_JS,
	DYNAMIC
}

export class RenderPreset<R extends RenderMethod,T extends html_content_or_generator> {
	constructor(public readonly __render_method:R, public readonly __content:T) {}
} 


// collapse RenderPreset, ... to HTML element or other content
export type html_content = Datex.CompatValue<HTMLElement|string|number|boolean|bigint>;
export type html_content_or_generator = html_content|((...args:unknown[])=>html_content|RenderPreset<RenderMethod, html_content>);
export type html_content_or_generator_or_preset = html_content_or_generator|RenderPreset<RenderMethod, html_content_or_generator>;

type get_content<C extends html_content_or_generator_or_preset> = 
	// if C is RenderPreset -> return RenderPreset.content
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

export function collapseToContent<T extends html_content_or_generator_or_preset>(content:T|undefined, path?:string, only_return_static_content = false): get_content<T> {
	
	if (content == undefined) return <get_content<T>>"";
	if (only_return_static_content && content && content.__render_method == RenderMethod.DYNAMIC) return <get_content<T>>"";


	// handle generator functions
	if (typeof content == "function") {
		return <get_content<T>>collapseToContent(content(), path, only_return_static_content)
	}
	// handle presets
	else if (content instanceof RenderPreset || (content && typeof content == "object" && !(content instanceof HTMLElement) && '__content' in content)) return <get_content<T>>collapseToContent(<html_content_or_generator>content.__content, path, only_return_static_content);

	// path object
	else if (!(content instanceof HTMLElement) && content && typeof content == "object") {
		// TODO better route resolution
		for (const route of [...Object.keys(content)].reverse()) {
			if (path?.startsWith(route)) return collapseToContent(content[route], undefined, only_return_static_content);
		}
		return <get_content<T>>"";
	}

	// collapsed content
	else return <get_content<T>>content;
}