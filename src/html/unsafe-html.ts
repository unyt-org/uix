import { Datex } from "datex-core-legacy/mod.ts";
import { domContext, domUtils } from "../app/dom-context.ts";

export function unsafeHTML(html:string, content?: Datex.RefOrValue<HTMLElement>|(Datex.RefOrValue<HTMLElement>)[]) {
	return domUtils.createHTMLElement(html, content)
}

export class RawHTML extends domContext.HTMLElement {
	constructor(public html: string) {
		super()
	}
}

/**
 * Inject raw HTML text into the rendered HTML, only supported for backend rendering
 * @param html 
 * @returns RawHTML
 */
export function rawHTML(html: string) {
	return new RawHTML(html);
}