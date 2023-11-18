import { Datex } from "datex-core-legacy/mod.ts";
import { domUtils } from "../app/dom-context.ts";

export function unsafeHTML(html:string, content?: Datex.RefOrValue<HTMLElement>|(Datex.RefOrValue<HTMLElement>)[]) {
	return domUtils.createHTMLElement(html, content)
}