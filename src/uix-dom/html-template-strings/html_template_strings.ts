import { Datex } from "datex-core-legacy";
import { escapeString, getParseJSX } from "../jsx/parser.ts";
import type { DOMContext } from "../dom/DOMContext.ts";
import type { DOMUtils } from "../datex-bindings/DOMUtils.ts";

const injectionMarker = '\x00';
const tagStart = /^<([\w\-.:]*|\x00\[\d+\])\s*( |\/|>)/;
const extractInjectedId = /\x00\[(\d+)\]/;
const extractInjectedIds = /\x00\[(\d+)\]/gm;
const extractInjectedIdsNoGroup = /\x00\[(?:\d+)\]/gm;
const attrStart = /^\s*([\w-]+)\s*=\s*/;
const string = /^("(?:(?:.|\n)*?[^\\])??(?:(?:\\\\)+)?"|'(?:(?:.|\n)*?[^\\])??(?:(?:\\\\)+)?')/;
const word = /^[\w-]+\b/;
const tagEnd = /^\s*(\/)?>/
const closingTag = /^<\/\s*([\w\-.:]*|\x00\[\d+\])\s*>/
const injectedDatex = /^\#\(/;
const untilTagClose = /[^<]*(?=<|$)/

/**
 * Alternative to JSX, just using native JS template strings
 * @param template html template string
 * @param content 
 * @returns 
 */
export function getHTMLGenerator(context: DOMContext, domUtils: DOMUtils, jsx: ReturnType<typeof getParseJSX>) {

	function decodeHTMLEntity(inputStr:string) {
		const textarea = context.document.createElement("textarea");
		textarea.innerHTML = inputStr;
		return textarea.value;
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
			const contentParts = inner.split(extractInjectedIdsNoGroup).map(v=>decodeHTMLEntity(v)); // convert &nbsp; etc
	
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
			if (!matchClose) console.warn("UIX.HTML: missing closing tag for " + (typeof tagName == "string" ? tagName : tagName.name))
			if (matchClose && matchClose![1]!=tagName) throw new Error("UIX.HTML: closing tag "+matchClose![1]+" does not match " + (typeof tagName == "string" ? tagName : tagName.name))
			if (matchClose) html = html.replace(matchClose![0], "").trimStart();
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
	
		// get value:
	
		// matched " or '
		if (attrValMatch) {
			html = html.replace(attrValMatch[0], "").trimStart();
			attrVal = attrValMatch?.[0]?.slice(1,-1)
		}
		// injected js
		else if (html.startsWith(injectionMarker)) {
			const match = html.match(extractInjectedId);
			attrVal = content[Number(match![1])];
			html = html.replace(match![0], "").trimStart();
			contentInserted = true;
		}
		// injected dx
		else if (html.match(injectedDatex)) {
			let [dx, newHTML] = html.split(")", 2)
			dx = dx.replace(injectedDatex, '')
			const injectedIds = [...dx.matchAll(extractInjectedIds)].map(v=>Number(v[1]));
			dx = dx.replaceAll(extractInjectedIds, Datex.INSERT_MARK);
			dx = `always(${dx})`;
			const injected = content.slice(injectedIds.at(0), injectedIds.at(-1)!+1)
			attrVal = datex(dx, injected)
			html = newHTML;
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
		if (!contentInserted && typeof attrVal=="string" && attrVal?.includes(injectionMarker)) {
			const injectedIds = [...attrVal.matchAll(extractInjectedIds)].map(v=>Number(v[1]));
			const injected = content.slice(injectedIds.at(0), injectedIds.at(-1)!+1)
			attrVal = attrVal.replaceAll(extractInjectedIds, Datex.INSERT_MARK);
			throw "todo: $$ transform for attribute"
		}
	
		attrs[attrName] = attrVal;
		return html;
	}
	


	// export function HTML(value:any): Element|DocumentFragment
	// export function HTML<R extends Element|DocumentFragment = Element|DocumentFragment>(template:TemplateStringsArray|string, ...content:(Element|Datex.CompatValue<unknown>)[]): R

	return function HTML(template:any, ...content:(Element|Datex.CompatValue<unknown>)[]) {
		const isTemplate = template?.raw instanceof Array && template instanceof Array;
		// non template value - convert to HTML node
		if (!isTemplate) {
			return domUtils.getTextNode(template);
		}
		// templatee
		else {
	
			// escape non-pointer strings in content
			for (let i=0; i<content.length; i++) {
				if (typeof content[i] === "string") content[i] = escapeString(content[i] as string);
			}
	
			// combine html
			let html = "";
			let c = 0;
			for (const raw of (template as unknown as TemplateStringsArray).raw) {
				html += raw;
				if (c<(template as unknown as TemplateStringsArray).raw.length-1) html += `\x00[${c++}]`;
			}
			html = html.trimStart();
			const all = [];
			while (true) {
				const [_html, ...children] = matchTag(html, content);
				html = _html;
				all.push(domUtils.valuesToDOMElement(...children));
				if (!html.trim()) break;
			}
			return domUtils.valuesToDOMElement(...all);
		}
		
	}	
}


