/**
 * EXPERIMENTAL
 */

import "./deno_dom.ts";
import "./render.ts";

import { $$, Datex } from "unyt_core";
import { HTMLUtils } from "../html/utils.ts";
import { DX_VALUE } from "unyt_core/datex_all.ts";


// handle htmlfragment (DocumentFragment)
Datex.Type.get('htmlfragment').setJSInterface({
    class: globalThis.DocumentFragment,

	create_proxy(value, pointer) {
		return value;
	},

	// called when replicating from state
	cast_no_tuple(val, type, ctx) {
		const fragment = new DocumentFragment();
		for (const child of val) {
			HTMLUtils.append(fragment, child);
		}
		return val;
	},

	serialize(val:DocumentFragment) {
		return [...val.children]
	}
})

// handles html/x and also casts from uix/x

Datex.Type.get('html').setJSInterface({
    class: globalThis.HTMLElement,

	get_type(val) {
		if (val instanceof HTMLElement) return Datex.Type.get('std', 'html', val.tagName.toLowerCase());
		else throw "not an HTMLElement"
	},

	// called when replicating from state
	cast_no_tuple(val, type, ctx) {

		const is_uix = type.name == "uix";
		if (!is_uix && !type.variation) throw new Error("cannot create HTMLElement without concrete type")
		
		// create HTMLElement / UIX component
		const el = is_uix ?
			type.newJSInstance(false) :  // call js constructor, but don't handle as constructor in lifecycle 
			document.createElement(type.variation); // create normal HTMLElement, no UIX lifecycle

		// set attrs, style, content from object
		if (typeof val == "object" && Object.getPrototypeOf(val) === Object.prototype) {
			for (const [prop,value] of Object.entries(val)) {
				if (prop=="style" && typeof value != "string") {
					for (const [prop, val] of Object.entries(value)) {
						el.style[prop] = val;
					}
				}
				else if (prop=="attr") {
					for (const [prop, val] of Object.entries(value)) {
						HTMLUtils.setElementAttribute(el, prop, val);
					}
				}
				else if (prop=="content") {
					for (const child of (value instanceof Array ? value : [value])) {
						if (child instanceof HTMLElement) HTMLUtils.append(el, <HTMLElement>child);
						else HTMLUtils.append(el, child);
					}
				}
			}
		}

		// set direct content when cast from different value
		else {
			if (val instanceof HTMLElement) HTMLUtils.append(el, <HTMLElement>val);
			else HTMLUtils.append(el, val);
		}

		
		// uix
		if (is_uix) {
			// set 'p' properties (contains options, other properties)
			if (val.p) type.initProperties(el, val.p);
			// trigger UIX lifecycle (onReplicate)
			type.construct(el, undefined, false, true);
		}
		
		return el;
	},

	serialize(val) {
		if (!(val instanceof HTMLElement)) throw "not an HTMLElement";
		const data: {style?:Record<string,string>, content?:any[], attr?:Record<string,unknown>} = {style: {}, attr: {}, content: []}

		// attributes
		for (let i = 0; i < val.attributes.length; i++) {
			const attrib = val.attributes[i];
			if (attrib.name !== "style" && attrib.name !== "data-ptr") data.attr[attrib.name] = attrib.value;
		}

		// style (uix _original_style)
		// @ts-ignore 
		const style = val._original_style??val.style;
		let style_props = style._importants ? [...Object.keys(style._importants)] : style;
		if (style_props && !(style_props instanceof Array || (globalThis.CSSStyleDeclaration && style_props instanceof globalThis.CSSStyleDeclaration))) style_props = [...Object.keys(style_props)];

		if (style_props instanceof Array) {
			for (const prop of style_props) {
				data.style[prop] = style[prop];
			}
		}
		
		// children
		for (let i = 0; i < val.childNodes.length; i++) {
			const child = val.childNodes[i];
			// @ts-ignore
			if (child instanceof Text) data.content.push(child[DX_VALUE] ?? child.textContent);
			else data.content.push(child);
		}
		// logger.info("serialize",data)

		// optimize serialization
		if (Object.keys(data.style).length == 0) delete data.style;
		if (Object.keys(data.attr).length == 0) delete data.attr;
		if (Object.keys(data.content).length == 0) delete data.content;

		if (data.content?.length == 1) {
			data.content = data.content[0];
		}

		return data;
	},

	get_property(parent, key) {
		return parent.getAttribute(key);
	},

	set_property_silently(parent, key, value) {
		parent[OBSERVER_IGNORE] = true; // ignore next observer event
		parent.setAttribute(key, value);
	},

	set_property(parent, key, value, exclude) {
		// has ptr (+ MutationObserver) - tell MutationObserver which endpoint to ignore when triggered for this update
		const ptr = Datex.Pointer.getByValue(parent);
		// @ts-ignore
		if (ptr && exclude) parent[OBSERVER_EXCLUDE_UPDATES] = exclude;
		parent.setAttribute(key, value);
	},

	create_proxy(val, pointer) {
		bindObserver(val);
		return val;
	}

})



const OBSERVER = Symbol("OBSERVER");
const OBSERVER_EXCLUDE_UPDATES = Symbol("OBSERVER_EXCLUDE_UPDATES");
const OBSERVER_IGNORE = Symbol("OBSERVER_IGNORE");


export function bindObserver(element:HTMLElement) {
	const pointer = Datex.Pointer.getByValue(element);
	if (!pointer) throw new Error("cannot bind observers for HTMLElement without pointer")
	if (!element.dataset['ptr']) element.dataset['ptr'] = pointer.id;

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
				if (mut.attributeName == "data-ptr") continue;
				// TODO find style changes, don't send full style attribute
				ptr.handleSetObservers(mut.attributeName)
			}
			else if (mut.type == "childList") {
				console.log("mut")//,mut, mut.addedNodes, mut.removedNodes)
			}
		}

		ptr.enableUpdatesForAll();
		
	}

	// @ts-ignore
	element[OBSERVER] = new MutationObserver(handler)
	// @ts-ignore
	// element[OBSERVER].observe(element, {attributes: true, childList: true})

	return element;
}