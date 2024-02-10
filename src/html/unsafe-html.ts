import { Datex } from "datex-core-legacy/mod.ts";
import { domUtils } from "../app/dom-context.ts";
import { HTMLElement } from "../uix-dom/dom/deno-dom/src/api.ts";


export function unsafeHTML(html:string, content?: Datex.RefOrValue<HTMLElement>|(Datex.RefOrValue<HTMLElement>)[]) {
	return domUtils.createHTMLElement(html, content)
}