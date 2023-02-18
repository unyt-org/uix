/**
 * EXPERIMENTAL
 */

import "./deno_dom.ts";

import { $$, Datex } from "unyt_core";
import { Utils } from "../base/utils.ts";
import { DX_VALUE } from "unyt_core/datex_all.ts";

// Datex.Type.get('html').setJSInterface({
//     class: globalThis.HTMLElement,

// 	get_type(val) {
// 		if (val instanceof HTMLElement) return Datex.Type.get('std', 'html', val.tagName.toLowerCase());
// 		else throw "not an HTMLElement"
// 	},

// 	cast(val, type, ctx) {
// 		if (!type.variation) throw new Error("cannot create HTMLElement without concrete type")
// 		const el = document.createElement(type.variation);

// 		// attrs + children tuple
// 		if (val instanceof Datex.Tuple) {
// 			for (const [prop,value] of val.named) {
// 				if (prop=="style" && typeof value != "string") {
// 					for (const [prop, val] of Object.entries(value)) {
// 						el.style[prop] = val;
// 					}
// 				}
// 				else Utils.setElementAttribute(el, prop, value);
// 			}
// 			for (const child of val.indexed) Utils.append(el, child);
// 		}
// 		// direct content
// 		else {
// 			if (val instanceof HTMLElement) el.append(val);
// 			else Utils.setElementText(el, val);
// 		}
// 		// console.log("cast", val, type.toString(), el)

// 		return el;
// 	},

// 	serialize(val) {
// 		if (!(val instanceof HTMLElement)) throw "not an HTMLElement";
// 		const data = new Datex.Tuple();

// 		// attributes
// 		for (let i = 0; i < val.attributes.length; i++) {
// 			const attrib = val.attributes[i];
// 			if (attrib.name !== "style") data.set(attrib.name, attrib.value)
// 		}

// 		// style
// 		const style:Record<string,string> = {};
// 		data.set("style",style);
// 		// @ts-ignore
// 		const style_props = val.style._importants? Object.keys(val.style._importants) : val.style;
// 		for (const prop of style_props) {
// 			style[prop] = val.style[prop];
// 		}

// 		// children
// 		for (let i = 0; i < val.childNodes.length; i++) {
// 			const child = val.childNodes[i];
// 			// @ts-ignore
// 			if (child instanceof Text) data.push(child[DX_VALUE] ?? child.textContent);
// 			else data.push(child);
// 		}

// 		// logger.info("serialize",data)

// 		return data;
// 	},

// 	get_property(parent, key) {
// 		return parent.getAttribute(key);
// 	},

// 	set_property_silently(parent, key, value) {
// 		parent[OBSERVER_IGNORE] = true; // ignore next observer event
// 		parent.setAttribute(key, value);
// 	},

// 	set_property(parent, key, value, exclude) {
// 		// has ptr (+ MutationObserver) - tell MutationObserver which endpoint to ignore when triggered for this update
// 		const ptr = Datex.Pointer.getByValue(parent);
// 		// @ts-ignore
// 		if (ptr && exclude) parent[OBSERVER_EXCLUDE_UPDATES] = exclude;
// 		parent.setAttribute(key, value);
// 	},

// 	create_proxy(val) {
// 		bindObserver(val);
// 		return val;
// 	}

// })



const OBSERVER = Symbol("OBSERVER");
const OBSERVER_EXCLUDE_UPDATES = Symbol("OBSERVER_EXCLUDE_UPDATES");
const OBSERVER_IGNORE = Symbol("OBSERVER_IGNORE");


export function bindObserver(element:HTMLElement) {
	console.log("bind datex ", element);

	// @ts-ignore
	if (element[OBSERVER]) return;

	const handler: MutationCallback = (mutations: MutationRecord[], observer: MutationObserver) => {
		// @ts-ignore
		if (element[OBSERVER_IGNORE]) {
			// @ts-ignore
			element[OBSERVER_IGNORE] = false;
			return;
		}
		const ptr = Datex.Pointer.getByValue(element);
		if (!ptr) return;

		// @ts-ignore
		if (element[OBSERVER_EXCLUDE_UPDATES]) {
			// @ts-ignore
			ptr.excludeEndpointFromUpdates(element[OBSERVER_EXCLUDE_UPDATES])
			// @ts-ignore
			element[OBSERVER_EXCLUDE_UPDATES] = undefined;
		}

		for (const mut of mutations) {
			if (mut.type == "attributes") {
				// TODO find style changes, don't send full style attribute
				ptr.handleSetObservers(mut.attributeName)
			}
			else if (mut.type == "childList") {
				console.log("mut",mut)
			}
		}

		ptr.enableUpdatesForAll();
		
	}

	// @ts-ignore
	element[OBSERVER] = new MutationObserver(handler)
	// @ts-ignore
	element[OBSERVER].observe(element, {attributes: true, childList: true})

	return element;
}