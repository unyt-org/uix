/**
 * EXPERIMENTAL
 */

import "./deno_dom.ts";

import { $$, Datex } from "unyt_core";
import { Utils } from "../base/utils.ts";

Datex.Type.get('html').setJSInterface({
    class: globalThis.HTMLElement,

	get_type(val) {
		if (val instanceof HTMLElement) return Datex.Type.get('std', 'html', val.tagName.toLowerCase());
		else throw "not an HTMLElement"
	},

	cast(val, type, ctx) {
		console.log("cast", val, type.toString())
		if (!type.variation) throw new Error("cannot create HTMLElement without concrete type")
		const el = document.createElement(type.variation);

		// attrs + children tuple
		if (val instanceof Datex.Tuple) {
			for (const [prop,value] of val.named) Utils.setElementAttribute(el, prop, value);
			for (const child of val.indexed) {
				if (child instanceof HTMLElement) el.append(child);
				else Utils.setElementText(el, child);
			}
		}
		// direct content
		else {
			if (val instanceof HTMLElement) el.append(val);
			else Utils.setElementText(el, val);
		}

		return el;
	},

	serialize(val) {
		if (!(val instanceof HTMLElement)) throw "not an HTMLElement";
		const data = new Datex.Tuple();
		for (let i = 0; i < val.attributes.length; i++) {
			const attrib = val.attributes[i];
			console.log(attrib)
		}

		return data;
	},

	create_proxy(val) {
		bindObserver(val);
		return val;
	}

})


export function bindObserver(element:Node) {
	console.log("bind datex ", element);

	const handler: MutationCallback = (mutations: MutationRecord[], observer: MutationObserver) => {
		console.log("mut", mutations)
	}
	`<html:div> (childs:[])`

	new MutationObserver(handler).observe(element, {attributes: true, childList: true})

	return element;
}


globalThis.bindDatex = bindObserver;