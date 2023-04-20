// deno-lint-ignore-file no-control-regex
import { Datex, text } from "unyt_core";
import { Res, Theme, HTMLUtils, logger } from "./uix_all.ts";
import { jsx } from "./jsx-runtime/jsx.ts";

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


const style_prop_regex = /([\w-]+)\s*:\s*$/;
const attr_regex = /([\w-]+)\s*=\s*$/;
const inside_el_header_regex = /<[^>]*$/;
const id_inject_regex = /<([^> ]*)(\s+[^>]*$)/;
const find_el_id_regex = /<[^> ]* id=["']?([^ "'\n>]+)["']?[^>]*$/;


const injectionMarker = '\x00';
const tagStart = /^<([\w\-.:]*|\x00\(\d+\))\s*( |\/|>)/;
const extractInjectedId = /\x00\((\d+)\)/;
const extractInjectedIds = /\x00\((\d+)\)/gm;
const extractInjectedIdsNoGroup = /\x00\((?:\d+)\)/gm;
const attrStart = /^\s*([\w-]+)\s*=\s*/;
const string = /^("(?:(?:.|\n)*?[^\\])??(?:(?:\\\\)+)?"|'(?:(?:.|\n)*?[^\\])??(?:(?:\\\\)+)?')/;
const word = /^[\w-]+\b/;
const tagEnd = /^\s*(\/)?>/
const closingTag = /^<\/\s*([\w\-.:]*|\x00\(\d+\))\s*>/

const untilTagClose = /[^<]*(?=<|$)/

export function unsafeHTML(html:string, content?: Datex.CompatValue<HTMLElement>|(Datex.CompatValue<HTMLElement>)[]) {
	return HTMLUtils.createHTMLElement(html, content)
}

/**
 * Alternative to JSX, just using native JS template strings
 * @param template html template string
 * @param content 
 * @returns 
 */
export function HTML(value:any): HTMLElement|DocumentFragment
export function HTML(template:TemplateStringsArray|string, ...content:(HTMLElement|Datex.CompatValue<unknown>)[]): HTMLElement|DocumentFragment
export function HTML(template:any, ...content:(HTMLElement|Datex.CompatValue<unknown>)[]) {
	const isTemplate = template?.raw instanceof Array && template instanceof Array;
	// just HTML string and children
	if (!isTemplate) {
		return HTMLUtils.getTextNode(template);
	}
	// template
	else {

		// combine html
		let html = "";
		let c = 0;
		for (const raw of (template as unknown as TemplateStringsArray).raw) {
			html += raw;
			if (c<(template as unknown as TemplateStringsArray).raw.length-1) html += `\x00(${c++})`;
		}
		html = html.trimStart();
		const all = [];
		while (true) {
			const [_html, ...children] = matchTag(html, content);
			html = _html;
			all.push(HTMLUtils.valuesToDOMElement(...children));
			if (!html.trim()) break;
		}
		console.log(all);
		return HTMLUtils.valuesToDOMElement(...all);
	}
	
}

function matchTag(html:string, content:any[]) {
	const start = html.match(tagStart);
	const tag = start?.[1];

	// no tag - html content
	if (!tag) {
		const matchInner = html.match(untilTagClose);
		if (!matchInner) throw new Error("UIX.HTML: Invalid HTML")
		const inner = matchInner[0];
		html = html.replace(matchInner[0], "").trimStart();
		const injectedIds = [...inner.matchAll(extractInjectedIds)].map(v=>Number(v[1]));
		const injected = content.slice(injectedIds.at(0), injectedIds.at(-1)!+1)
		const contentParts = inner.split(extractInjectedIdsNoGroup);

		const combined = contentParts.map((e,i) => [e, injected[i]]).flat().slice(0, -1).filter(c=>c!=="");
		return [html, ...combined]
	}

	html = html.replace(start[0], "").trimStart();
	const immediateTagClose = start[2] == "/";
	const noAttrs = immediateTagClose || start[2] == ">"

	// reinsert immediately closing > or /
	if (immediateTagClose) html = "/" + html
	else if (noAttrs) html = ">" + html

	let tagName:string|Function = tag;
	if (tag.startsWith(injectionMarker)) tagName = content[Number(tag.match(extractInjectedId)![1])]

	// tag start - attributes
	const attrs = {children: []} as JSX.ElementChildrenAttribute & {children:any[]};

	if (!noAttrs) {
		while (html && !html.match(tagEnd)) {
			html = matchAttribute(html, content, attrs).trimStart();
		}
	}
	
	const endMatch = html.match(tagEnd)!;
	const selfClosing = immediateTagClose || !!endMatch[1]
	html = html.replace(endMatch[0], "").trimStart();
	
	// children
	if (!selfClosing) {
		let matchClose:RegExpMatchArray|null|undefined
		while (html && !((matchClose=html.match(closingTag)))) {
			const [newhtml, ...children] = matchTag(html, content);
			attrs.children.push(...children);
			html = newhtml;
		}
		if (!matchClose) logger.warn("UIX.HTML: missing closing tag for " + (typeof tagName == "string" ? tagName : tagName.name))
		if (matchClose![1]!=tagName) throw new Error("UIX.HTML: closing tag "+matchClose![1]+" does not match " + (typeof tagName == "string" ? tagName : tagName.name))
		html = html.replace(matchClose![0], "").trimStart();
	}

	// single child
	if (attrs.children.length == 1) attrs.children = attrs.children[0];


	return [html, jsx(tagName, attrs)] as const;
}

function matchAttribute(html:string, content:any[], attrs:Record<string,any>) {

	if (!html.match(word)) {
		throw new Error("UIX.HTML: invalid token (near '"+html+"')")
	}

	// attr=
	const attr = html.match(attrStart);
	// standalone attribute without value
	if (!attr) {
		const trueAttr = html.match(word);
		if (trueAttr) {
			html = html.replace(trueAttr[0], "").trimStart();
			attrs[trueAttr[0]] = true;
		}
		return html;
	}

	html = html.replace(attr[0], "").trimStart();
	const attrName = attr[1];

	const attrValMatch = html.match(string);

	let attrVal: any;
	let contentInserted = false;

	// matched " or '
	if (attrValMatch) {
		html = html.replace(attrValMatch[0], "").trimStart();
		attrVal = attrValMatch?.[0]?.slice(1,-1)
	}
	// injected
	else if (html.startsWith(injectionMarker)) {
		const match = html.match(extractInjectedId);
		attrVal = content[Number(match![1])];
		html = html.replace(match![0], "").trimStart();
		contentInserted = true;
	}
	// unescaped value
	else if (html.match(word)) {
		const valMatch = html.match(word);
		if (!valMatch) throw new Error("UIX.HTML: Invalid HTML, invalid attribute definition ("+attrName+")");
		html = html.replace(valMatch[0], "").trimStart();
		attrVal = valMatch[0];
	}
	else {
		throw new Error("UIX.HTML: Invalid HTML, invalid attribute definition ("+attrName+")");
	}

	// resolve "\x00(1)"
	if (!contentInserted && attrVal.includes(injectionMarker)) {
		const injectedIds = [...attrVal.matchAll(extractInjectedIds)].map(v=>Number(v[1]));
		const injected = content.slice(injectedIds.at(0), injectedIds.at(-1)!+1)
		attrVal = attrVal.replaceAll(extractInjectedIds, '(?)');
		console.log(injected, attrVal);
		throw "todo: $$ transform for attribute"
	}

	attrs[attrName] = attrVal;
	return html;
}

// @ts-ignore global HTML
globalThis.HTML = HTML;

const _HTML = HTML;

/**
 * bind to origin in function prototype
 */

declare global {

	const HTML: typeof _HTML;

	interface CallableFunction {
		bindToOrigin<T, A extends unknown[], R>(this: (this: T, ...args: A) => R, context?:any): (...args: A)=>Promise<Awaited<Promise<R>>>;
	}
}

// @ts-ignore
Function.prototype.bindToOrigin = function (this:(...args: any)=>any, context:any) {
	return bindToOrigin(this, context);
}