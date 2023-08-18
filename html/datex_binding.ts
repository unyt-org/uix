/**
 * EXPERIMENTAL
 */

import "./deno_dom.ts";
import "./render.ts";

import { $$, Datex } from "unyt_core";
import { HTMLUtils } from "../html/utils.ts";
import { DX_VALUE, INIT_PROPS, logger } from "unyt_core/datex_all.ts";
import { STANDALONE } from "../standalone/bound_content_properties.ts";
import { DX_IGNORE } from "unyt_core/runtime/constants.ts";


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
		return fragment;
	},

	serialize(val:DocumentFragment) {
		return serializeChildren(val)
	}
})

function serializeChildren(parent:Element|DocumentFragment) {
	// children
	const children = [];
	for (let i = 0; i < parent.childNodes.length; i++) {
		const child = parent.childNodes[i];
		// @ts-ignore
		if (child instanceof Text) children.push(child[DX_VALUE] ?? child.textContent);
		else children.push(child);
	}
	return children;
}

// handles html/x and also casts from uix/x

const elementInterface:Datex.js_interface_configuration & {_name:string} = {
	_name: "unset",

	get_type(val) {
		if (val instanceof this.class!) return Datex.Type.get('std', this._name, val.tagName.toLowerCase());
		else throw "not an " + this.class!.name;
	},

	// called when replicating from state
	cast_no_tuple(val, type, ctx) {

		const is_uix = type.name == "uix";
		if (!is_uix && !type.variation) throw new Error("cannot create "+this.class!.name+" without concrete type")
		
		const propertyInitializer = is_uix ? type.getPropertyInitializer(val.p) : null;

		// create HTMLElement / UIX component
		const el = is_uix ?
			type.newJSInstance(false, undefined, propertyInitializer!) :  // call js constructor, but don't handle as constructor in lifecycle 
			HTMLUtils.createElement(type.variation); // create normal Element, no UIX lifecycle

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
						if (child instanceof this.class!) HTMLUtils.append(el, <Element>child);
						else HTMLUtils.append(el, child);
					}
				}
				else if (prop=="shadowroot") {
					const shadowRoot = el.attachShadow({mode:"open"});
					shadowRoot.append(value);
				}
			}
		}

		// set direct content when cast from different value
		else {
			if (val instanceof this.class!) HTMLUtils.append(el, <Element>val);
			else HTMLUtils.append(el, val);
		}

		
		// uix
		if (is_uix) {
			// set 'p' properties (contains options, other properties)
			propertyInitializer![INIT_PROPS](el);
			// trigger UIX lifecycle (onReplicate)
			type.construct(el, undefined, false, true);
		}
		
		return el;
	},

	serialize(val: Element&{[HTMLUtils.EVENT_LISTENERS]?:Map<keyof HTMLElementEventMap, Set<Function>>}) {
		if (!(val instanceof this.class!)) throw "not an " + this.class!.name;
		const data: {style:Record<string,string>, content:any[], attr:Record<string,unknown>, shadowroot?:DocumentFragment} = {style: {}, attr: {}, content: []}

		// attributes
		for (let i = 0; i < val.attributes.length; i++) {
			const attrib = val.attributes[i];
			if (attrib.name !== "style" && attrib.name !== "data-ptr") data.attr[attrib.name] = attrib.value;
		}
		// event handler attributes
		for (const [name, handlers] of val[HTMLUtils.EVENT_LISTENERS]??[]) {
			const allowedHandlers = [];
			for (const handler of handlers) {
				if (handler[STANDALONE]) logger.error("@standalone and UIX.inDisplayContext functions are currently not supported with UIX.renderDynamic/UIX.renderWithHydration ("+(handler.name??'anonymous function')+")")
				else allowedHandlers.push($$(handler))
			}
			data.attr['on'+name] = allowedHandlers;
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
		data.content = serializeChildren(val);

		// shadowroot
		if (val.shadowRoot && !(<any>val.shadowRoot)[DX_IGNORE]) {
			data.shadowroot = val.shadowRoot;
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

}


Datex.Type.get('html').setJSInterface(Object.assign(Object.create(elementInterface), {
	_name: 'html',
    class: globalThis.HTMLElement
}))

Datex.Type.get('svg').setJSInterface(Object.assign(Object.create(elementInterface), {
	_name: 'svg',
    class: globalThis.SVGElement
}))

// Datex.Type.get('mathml').setJSInterface(Object.assign(Object.create(elementInterface), {
//     class: globalThis.MathMLElement
// }))

const OBSERVER = Symbol("OBSERVER");
const OBSERVER_EXCLUDE_UPDATES = Symbol("OBSERVER_EXCLUDE_UPDATES");
const OBSERVER_IGNORE = Symbol("OBSERVER_IGNORE");


export function bindObserver(element:Element) {
	const pointer = Datex.Pointer.getByValue(element);
	if (!pointer) throw new Error("cannot bind observers for HTMLElement without pointer")
	if (!element.dataset) throw new Error("element has nodaset, todo");
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