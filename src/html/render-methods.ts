import { UIX } from "../uix.ts";
import { logger } from "../utils/global-values.ts";
import { html_content_or_generator } from "./entrypoints.ts";
import { DX_IGNORE } from "datex-core-legacy/runtime/constants.ts";


/**
 * Default rendering method.
 * Server side prerendering, content hydration over DATEX.
 * \@display properties and functions and :display attributes are supported, during initialization only with JSON compatible values.
 * Provides a full DATEX Runtime on the frontend.
 * @param content HTML element or text content
 */
export function renderHybrid<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.HYBRID, T> {
	if (!UIX.isHeadless) logger.warn("render methods have no effect for components created on the client side (renderHybrid)")
	return new RenderPreset(RenderMethod.HYBRID, content)
}

/**
 * Server side prerendering, overriding with content on frontend
 * @param content HTML element or text content
 */
export function renderPreview<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.HYBRID, T> {
	if (!UIX.isHeadless) logger.warn("render methods have no effect for components created on the client side (renderPreview)")
	const preset = new RenderPreset(RenderMethod.HYBRID, content)
	// @ts-ignore
	preset[DX_IGNORE] = true;
	return preset
}


/**
 * Serve server-side rendererd HTML to the frontend, enable limited JS interactivity
 * Provides no DATEX runtime functionality on the frontend.
 * \@display properties and functions and :display attributes are supported, but only with JSON compatible values.
 * Content is not loaded over DATEX
 * @param content HTML element or text content
 */
export function renderBackend<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.BACKEND, T> {
	if (!UIX.isHeadless) logger.warn("render methods have no effect for components created on the client side (renderBackend)")
	return new RenderPreset(RenderMethod.BACKEND, content)
}

/**
 * Just serve static HTML pages to the frontend, no frontend JS at all
 * Dynamic functionality like event listeners, \@display and :display is completely ignored
 * @param content HTML element or text content
 */
export function renderStatic<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.STATIC, T> {
	if (!UIX.isHeadless) logger.warn("render methods have no effect for components created on the client side (renderStatic)")
	return new RenderPreset(RenderMethod.STATIC, content)
}

/**
 * No server side prerendering, serve all content over DATEX.
 * Provides a full DATEX runtime on the frontend.
 * \@display properties and functions and :display attributes are fully supported
 * @param content HTML element or text content
 */
export function renderDynamic<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.DYNAMIC, T> {
	if (!UIX.isHeadless) logger.warn("render methods have no effect for components created on the client side (renderDynamic)")
	return new RenderPreset(RenderMethod.DYNAMIC, content)
}




export enum RenderMethod {
	HYBRID, // Server side prerendering, content hydration over DATEX
	BACKEND, // Serve server-side rendererd HTML to the frontend, runtime + reactivity on the backend, display context native js functionality
	STATIC, // Just serve static HTML pages to the frontend, no frontend JS at all
	DYNAMIC, // No server side prerendering, loading all content over DATEX
	RAW_CONTENT, // Serve raw file content
}


export class RenderPreset<R extends RenderMethod = RenderMethod,T extends html_content_or_generator<any,any> = html_content_or_generator> {
	constructor(public readonly __render_method:R, public readonly __content:T) {
		// don't transmit from backend to frontend via DATEX if static
		if (this.__render_method == RenderMethod.BACKEND || this.__render_method == RenderMethod.STATIC) {
			// @ts-ignore
			this[DX_IGNORE] = true;
		}
	}
} 