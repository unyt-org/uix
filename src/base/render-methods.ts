import { UIX } from "../../uix.ts";
import { logger } from "../utils/global-values.ts";
import { Entrypoint, html_content, html_content_or_generator, html_generator } from "../providers/entrypoints.ts";
import { DX_IGNORE, DX_SERIALIZED, DX_SOURCE } from "datex-core-legacy/runtime/constants.ts";
import { JSTransferableFunction } from "datex-core-legacy/types/js-function.ts";
import { DOMUtils } from "../uix-dom/datex-bindings/dom-utils.ts";


/**
 * Default rendering method.
 * Server side prerendering, content hydration over DATEX.
 * \@frontend properties and functions and :frontend attributes are supported, during initialization only with JSON compatible values.
 * Provides a full DATEX Runtime on the frontend.
 * @param content HTML element or text content
 */
export function renderHybrid<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.HYBRID, T> {
	if (UIX.context == "frontend") logger.warn("render methods have no effect for components created on the client side (renderHybrid)")
	return new RenderPreset(RenderMethod.HYBRID, content)
}

/**
 * Server side prerendering, overriding with content on frontend
 * @param content HTML element or text content
 * @deprecated use renderHybrid and slot default content for backend rendered content that gets overriden by frontend content
 */
export function renderPreview<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.PREVIEW, T> {
	if (UIX.context == "frontend") logger.warn("render methods have no effect for components created on the client side (renderPreview)")
	return new RenderPreset(RenderMethod.PREVIEW, content)
}


/**
 * Serve server-side rendererd HTML to the frontend, enable limited JS interactivity
 * Provides no DATEX runtime functionality on the frontend.
 * \@frontend properties and functions and :frontend attributes are supported, but only with JSON compatible values.
 * Content is not loaded over DATEX
 * @param content HTML element or text content
 */
export function renderBackend<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.BACKEND, T> {
	if (UIX.context == "frontend") logger.warn("render methods have no effect for components created on the client side (renderBackend)")
	return new RenderPreset(RenderMethod.BACKEND, content)
}

/**
 * Just serve static HTML pages to the frontend, no frontend JS at all
 * Dynamic functionality like event listeners, \@frontend and :frontend is completely ignored
 * @param content HTML element or text content
 */
export function renderStatic<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.STATIC, T> {
	if (UIX.context == "frontend") logger.warn("render methods have no effect for components created on the client side (renderStatic)")
	return new RenderPreset(RenderMethod.STATIC, content)
}

/**
 * No server side prerendering, serve all content over DATEX.
 * Provides a full DATEX runtime on the frontend.
 * \@frontend properties and functions and :frontend attributes are fully supported
 * @param content HTML element or text content
 */
export function renderDynamic<T extends html_content_or_generator>(content:T): RenderPreset<RenderMethod.DYNAMIC, T> {
	if (UIX.context == "frontend") logger.warn("render methods have no effect for components created on the client side (renderDynamic)")
	return new RenderPreset(RenderMethod.DYNAMIC, content)
}


/**
 * Render on frontend only, no server side prerendering.
 * This function can be used to request frontend rendering from a backend context.
 * @param content_generator 
 * @returns 
 */
export function renderFrontend(content_generator:() => JSX.singleChild|Promise<JSX.singleChild>, placeholder?: html_content): JSX.singleChild {
	if (UIX.context == "frontend") {
		return content_generator()
	}
	else {
		const fn = JSTransferableFunction.functionIsAsync(content_generator) ?
			JSTransferableFunction.createAsync(content_generator).then(fn=>{
				fn = $(fn);
				(fn as any)[DOMUtils.PLACEHOLDER_CONTENT] = placeholder ?? "";
				return fn;
			}) :
			$(JSTransferableFunction.create(content_generator));
		(fn as any)[DOMUtils.PLACEHOLDER_CONTENT] = placeholder ?? "";
		return fn
	}
}


export enum RenderMethod {
	HYBRID, // Server side prerendering, content hydration over DATEX
	BACKEND, // Serve server-side rendererd HTML to the frontend, runtime + reactivity on the backend, frontend context native js functionality
	STATIC, // Just serve static HTML pages to the frontend, no frontend JS at all
	DYNAMIC, // No server side prerendering, loading all content over DATEX
	RAW_CONTENT, // Serve raw response content
	PREVIEW, // // Server side prerendering, override with content on frontend
	CACHED_RESPONSE // Serve side cached response, content is token to cached response
}


export class RenderPreset<R extends RenderMethod = RenderMethod, T extends html_content_or_generator<any,any> = html_content_or_generator> {
	constructor(public readonly __render_method:R, public readonly __content:T, public readonly __status_code?:number) {
		// don't transmit from backend to frontend via DATEX if static
		if (this.__render_method == RenderMethod.BACKEND || this.__render_method == RenderMethod.STATIC) {
			// @ts-ignore
			this[DX_IGNORE] = true;
		}
	}
} 