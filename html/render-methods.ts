import { IS_HEADLESS } from "../utils/constants.ts";
import { logger } from "../utils/global_values.ts";
import { html_content_or_generator } from "./entrypoints.ts";
import { DX_IGNORE } from "unyt_core/runtime/constants.ts";


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




export enum RenderMethod {
	HYDRATION, // Server side prerendering, content hydration over DATEX
	STATIC, // Just serve static HTML pages to the frontend, + some frontend JS for functionality
	STATIC_NO_JS, // Just serve static HTML pages to the frontend, no frontend JS at all
	DYNAMIC, // No server side prerendering, loading all content over DATEX
	RAW_CONTENT, // Serve raw file content
}


export class RenderPreset<R extends RenderMethod = RenderMethod,T extends html_content_or_generator<any,any> = html_content_or_generator> {
	constructor(public readonly __render_method:R, public readonly __content:T) {
		// don't transmit from backend to frontend via DATEX if static
		if (this.__render_method == RenderMethod.STATIC || this.__render_method == RenderMethod.STATIC_NO_JS) {
			// @ts-ignore
			this[DX_IGNORE] = true;
		}
	}
} 