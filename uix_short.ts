import { Datex } from "unyt_core";
import { Res, Theme, HTMLUtils } from "./uix_all.ts";

export {content, id, use, Component, NoResources, Element} from "./uix_all.ts";

/** make decorators global */
import {content as _content, id as _id, use as _use, NoResources as _NoResources, Component as _Component, standalone as _standalone} from "./uix_all.ts";

declare global {
	const content: typeof _content;
	const id: typeof _id;
	const use: typeof _use;
	const Component: typeof _Component;
	const NoResources: typeof _NoResources;
	const standalone: typeof _standalone;
}

// @ts-ignore global
globalThis.content = _content;
// @ts-ignore global
globalThis.id = _id;
// @ts-ignore global
globalThis.use = _use;
// @ts-ignore global
globalThis.Component = _Component;
// @ts-ignore global
globalThis.NoResources = _NoResources;
// @ts-ignore global
globalThis.standalone = _standalone;

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

// shortcut extension of createHTMLElement with extended template support (attributes, style properties, nested HTML)
export function HTML (name:TemplateStringsArray|string, ...content:(HTMLElement|Datex.CompatValue<unknown>)[]) {
	// just HTML string and children
	if (typeof name == "string") {
		return HTMLUtils.createHTMLElement(name, content);
	}
	// template
	else {

		const uuid = Math.round(Math.random()*1000) + "" + new Date().getTime();
		const style_injections:Record<number,[prop:string,el_id:string]> = {}
		const attribute_injections:Record<number,[prop:string,el_id:string]> = {}

		let html = "";
		let c = 0;
		for (const raw of name.raw) {
			html += raw;
			// insert

			if (c<name.raw.length-1) {
				// element/style attributes
				if (html.match(inside_el_header_regex)) {
					let el_id:string|undefined;

					// does not yet have an assigned id?
					if (!(el_id = html.match(find_el_id_regex)?.[1])) {
						el_id = `el_${uuid}_${c}`;
						// inject unique id for element at beginning of tag
						html = html.replace(id_inject_regex,`<$1 id=${el_id} $2`);
					}

					// style property
					const style_prop = html.match(style_prop_regex)?.[1];
					if (style_prop) {
						// remove from html
						html = html.replace(style_prop_regex, '');
						style_injections[c] = [style_prop, el_id];
					}

					else {
						// normal attribute
						const attr = html.match(attr_regex)?.[1];
						if (attr) {
							// remove from html
							html = html.replace(attr_regex, '');
							attribute_injections[c] = [attr, el_id];
						}
						
						else {
							throw Error("invalid injection in HTML")
						}
					}
					
					
				}
				// element child
				else {
					html += `<span class=tmp-${c}>?</span>`;
				}
			}
			
			c++;
		}

		// console.log(html, style_injections, attribute_injections)

		const el = HTMLUtils.createHTMLElement(html);

		const findElement = (id:string)=>{
			// find element
			let parent:HTMLElement|null;
			if (el.id == id) parent = el;
			else parent = el.querySelector('#'+id);
			if (!parent) throw Error("HTML parsing error");
			return parent;
		}


		// inject content
		c = 0;
		for (const child of content) {

			// inject style
			if (c in style_injections) {
				const [prop, id] = style_injections[c];
				// find element
				const parent = findElement(id);
				HTMLUtils.setCSSProperty(parent, prop, child)
			}
			// inject attribute
			else if (c in attribute_injections) {
				const [attr, id] = attribute_injections[c];
				// find element
				const parent = findElement(id);
				// on-x handler function
				if (attr.startsWith("on") && child instanceof Function) {
					parent.addEventListener(<keyof HTMLElementEventMap> attr.replace("on",""), <any>child);
				}
				else HTMLUtils.setElementAttribute(parent, attr, child)
				// console.log("attr parent",parent,attr,child)
			}

			else {
				// insert child
				const tmp = <HTMLElement> el.querySelector(".tmp-"+c);
				if (!tmp) throw Error("HTML parsing error");
				if (child instanceof HTMLElement) tmp.replaceWith(child);
				else if (child instanceof Array) {
					tmp.innerHTML = "";
					// tmp.style.all = "inherit"; //TODO keep?
					tmp.append(...child);
				}
				else HTMLUtils.setElementText(tmp, child);
			}

			c++;

		}

		return el;
	}
	
}