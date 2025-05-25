import { Datex } from "datex-core-legacy/mod.ts";
import { domContext, domUtils } from "../app/dom-context.ts";
import type { HTMLElement } from "../uix-dom/dom/deno-dom/src/api.ts";

/**
 * Injects raw HTML into the DOM by converting the HTML string to a DOM node
 * @param html 
 * @param content 
 * @returns 
 */
export function unsafeHTML(html:string, content?: Datex.RefOrValue<HTMLElement>|(Datex.RefOrValue<HTMLElement>)[]) {
	return domUtils.createHTMLElement(html, content)
}

export class RawHTML extends domContext.HTMLElement {
    constructor(public html: string) {
        super()
    }
}

/**
 * Injects raw HTML text into the rendered HTML.
 * This method is currently only supported for backend rendering.
 * @param html 
 * @returns RawHTML
 */
export function rawHTML(html: string) {
    return new RawHTML(html);
}
