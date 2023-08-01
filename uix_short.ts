// deno-lint-ignore-file no-control-regex
import { Datex, text } from "unyt_core";
import { Res, Theme, HTMLUtils, logger } from "./uix_all.ts";
import { HTML } from "./utils/html_template_strings.ts";
import { SCSS } from "./utils/css_template_strings.ts";

export { HTML } from "./utils/html_template_strings.ts";
export { SCSS } from "./utils/css_template_strings.ts";

export {content, id, use, Component, NoResources, Element} from "./uix_all.ts";

/** make decorators global */
import {content as _content, bindOrigin as _bindOrigin, id as _id, layout as _layout, child as _child, use as _use, NoResources as _NoResources, Component as _Component, standalone as _standalone} from "./uix_all.ts";
import { bindToOrigin } from "./utils/datex_over_http.ts";

declare global {
	const content: typeof _content;
	const id: typeof _id;
	const layout: typeof _layout;
	const child: typeof _child;
	const use: typeof _use;
	const Component: typeof _Component;
	const NoResources: typeof _NoResources;
	const standalone: typeof _standalone;
	const bindOrigin: typeof _bindOrigin;
}

// @ts-ignore global
globalThis.content = _content;
// @ts-ignore global
globalThis.id = _id;
// @ts-ignore global
globalThis.use = _use;
// @ts-ignore global
globalThis.child = _child;
// @ts-ignore global
globalThis.layout = _layout;
// @ts-ignore global
globalThis.Component = _Component;
// @ts-ignore global
globalThis.NoResources = _NoResources;
// @ts-ignore global
globalThis.standalone = _standalone;
// @ts-ignore global
globalThis.bindOrigin = _bindOrigin;

// GET STRING reference
export function S (_s:TemplateStringsArray|string|Datex.Value<string>, ...params:string[]):Datex.Value<string> {
	let s = Res.getStringReference((typeof _s == "string"||_s instanceof Datex.Value) ? _s : _s?.raw[0]);
	if (params?.length) {
		throw "TODO S params"
		// s = transform([s, ...params], (string)=>string.replace(/[^\\](\$\d*)/g, (substring: string) => {
		// 	return substring[0] + params[parseInt(substring.slice(1).replace("$", ""))]
		// }));
	}
	return s;
}

// GET String value
export function SVAL (_s:TemplateStringsArray|string, ...params:string[]):string {
	let s = Res.getString(typeof _s == "string" ? _s : _s?.raw[0]);
	if (params?.length) {
		s = s.replace(/[^\\](\$\d*)/g, (substring: string) => {
			return substring[0] + params[parseInt(substring.slice(1).replace("$", ""))]
		});
	}
	return s;
}

// GET HTML FORMATTED STRING
export function S_HTML (name:TemplateStringsArray|string, ...params:string[]):string {
	return SVAL(name, ...params).replace("\n", "<br>");
}

// GET ICON (HTML)
export function I (_name:TemplateStringsArray|string, color?:string){
	let name = typeof _name == "string" ? _name : _name?.raw[0];
	if (!name) return "";

	// already converted to html
	if (name.startsWith("<span")) return name;

	let class_fa = "fa"
	if (name.startsWith("uix-")) {
		class_fa = "uix"
		name = name.replace("uix", "fa");
	}
	if (name.startsWith("fas-")) {
		class_fa = "fas"
		name = name.replace("fas", "fa");
	}
	else if (name.startsWith("fab-")) {
		class_fa = "fab"
		name = name.replace("fab", "fa");
	}
	else if (name.startsWith("far-")) {
		class_fa = "far"
		name = name.replace("far", "fa");
	}

	if (color) return `<span style="color:${color}" class="${class_fa} ${name}"></span>`
	else return `<span class="${class_fa} ${name}"></span>`
}

export function IEL (_name:TemplateStringsArray|string, color?:string):HTMLSpanElement{
	return HTMLUtils.createHTMLElement(I(_name, color));
}

// get Theme Color
export function C (name:TemplateStringsArray|string, ...params:string[]) {
	return Theme.getColorReference(typeof name == "string" ? name : name?.raw[0])
}

export function unsafeHTML(html:string, content?: Datex.CompatValue<HTMLElement>|(Datex.CompatValue<HTMLElement>)[]) {
	return HTMLUtils.createHTMLElement(html, content)
}

// @ts-ignore global HTML
globalThis.HTML = HTML;
// @ts-ignore global HTML
globalThis.SCSS = SCSS;


/**
 * bind to origin in function prototype
 */

const _HTML = HTML;
const _SCSS = SCSS;

declare global {

	const HTML: typeof _HTML;
	const SCSS: typeof _SCSS;

	interface CallableFunction {
		bindToOrigin<T, A extends unknown[], R>(this: (this: T, ...args: A) => R, context?:any): (...args: A)=>Promise<Awaited<Promise<R>>>;
	}
}

// @ts-ignore
Function.prototype.bindToOrigin = function (this:(...args: any)=>any, context:any) {
	return bindToOrigin(this, context);
}