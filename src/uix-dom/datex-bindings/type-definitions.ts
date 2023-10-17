import { $$, Datex } from "datex-core-legacy";
import { DOMUtils } from "./DOMUtils.ts"
import { DX_VALUE, INIT_PROPS, logger } from "datex-core-legacy/datex_all.ts";
import { DX_IGNORE } from "datex-core-legacy/runtime/constants.ts";
import type { DOMContext } from "../dom/DOMContext.ts";
import type { Element, DocumentFragment, MutationObserver, Document, HTMLElement, Node } from "../dom/mod.ts"
import { querySelector } from "../dom/shadow_dom_selector.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";
// import { blobToBase64 } from "./blob-to-base64.ts";

let definitionsLoaded = false;

const OBSERVER = Symbol("OBSERVER");
const OBSERVER_EXCLUDE_UPDATES = Symbol("OBSERVER_EXCLUDE_UPDATES");
const OBSERVER_IGNORE = Symbol("OBSERVER_IGNORE");


export type BindingOptions = {
	mapFileURL?: (url: `file://${string}`) => string
}

export function loadDefinitions(context: DOMContext, domUtils: DOMUtils, options?: BindingOptions) {

	// definitions cannot be loaded multiple times
	if (definitionsLoaded) throw new Error("DATEX type binding very already loaded for a window object")
	definitionsLoaded = true;

	function bindObserver(element:Element) {
		const pointer = Datex.Pointer.getByValue(element);
		if (!pointer) throw new Error("cannot bind observers for HTMLElement without pointer")
		if (!element.dataset) {
			console.log(element)
			throw new Error("element has no dataset, todo");
		}
		if (!element.hasAttribute("uix-ptr")) element.setAttribute("uix-ptr", pointer.id);

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
					if (mut.attributeName == "uix-ptr") continue;
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
		element[OBSERVER] = new context.MutationObserver(handler)
		// @ts-ignore
		// element[OBSERVER].observe(element, {attributes: true, childList: true})

		return element;
	}



	// handle htmlfragment (DocumentFragment)
	Datex.Type.get('htmlfragment').setJSInterface({
		class: context.DocumentFragment,

		create_proxy(value, pointer) {
			return value;
		},

		// called when replicating from state
		cast_no_tuple(val) {
			const fragment = new context.DocumentFragment();
			for (const child of val) {
				domUtils.append(fragment, child);
			}
			return fragment;
		},

		serialize(val:DocumentFragment) {
			return serializeChildren(val)
		}
	})

	// handle htmlfragment (Document)
	Datex.Type.get('htmldocument').setJSInterface({
		class: context.Document,

		create_proxy(value, pointer) {
			return value;
		},

		// called when replicating from state
		cast_no_tuple(val) {
			const document = new context.Document();
			for (const child of val) {
				document.appendChild(child);
			}
			return document;
		},

		serialize(val:Document) {
			return serializeChildren(val)
		}
	})

	function serializeChildren(parent:Element|DocumentFragment|Document) {
		// children
		const children = [];
		for (let i = 0; i < parent.childNodes.length; i++) {
			const child = parent.childNodes[i];
			if (child instanceof context.Text) children.push(child[DX_VALUE] ?? child.textContent);
			else children.push(child);
		}
		return children;
	}

	function getExistingElement(ptrId?: string) {
		if (!ptrId) return;
		if (client_type == "browser") {
			const existingElement = querySelector(`[uix-ptr="${ptrId}"]`) as Element;
			existingElement?.removeAttribute("uix-static");
			existingElement?.setAttribute("uix-hydrated", "");
			return existingElement;
		}
	}

	// handles html/x and also casts from uix/x

	const elementInterface:Datex.js_interface_configuration & {_name:string} = {
		_name: "unset",

		get_type(val) {
			if (val instanceof this.class!) return Datex.Type.get('std', this._name, val.tagName.toLowerCase());
			else throw "not an " + this.class!.name;
		},

		// called when replicating from state
		cast_no_tuple(val, type, _ctx, _origin, assigningPtrId) {

			// merge with existing element in DOM
			const existingElement = getExistingElement(assigningPtrId)

			const isComponent = type.name == "uix";
			if (!isComponent && !type.variation) throw new Error("cannot create "+this.class!.name+" without concrete type")
			
			const propertyInitializer = isComponent ? type.getPropertyInitializer(val.p) : null;

			// create HTMLElement / UIX component
			const el = existingElement ?? (
				isComponent ?
				type.newJSInstance(false, undefined, propertyInitializer!) :  // call js constructor, but don't handle as constructor in lifecycle 
				domUtils.createElement(type.variation) // create normal Element, no UIX lifecycle
			);

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
							domUtils.setElementAttribute(el, prop, val);
						}
					}
					else if (prop=="content") {
						// only update new content
						if (existingElement) {
							const currentChildNodes = [...existingElement.childNodes as Iterable<Node>];
							let i = 0;
							for (const child of (value instanceof Array ? value : [value])) {
								let currentChild:any = currentChildNodes[i];
								if (currentChild instanceof context.Text) currentChild = currentChild.textContent;
								
								// child does no exist, just append
								if (currentChildNodes[i] === undefined) {
									// console.log("append",child)
									domUtils.append(el, child);
								}
								// different child, replace
								else if (child !== currentChild) {
									// console.log("replace",currentChildNodes[i], child)
									currentChildNodes[i].replaceWith(child);
								}
								i++;
							}
						}
						// append content
						else {
							for (const child of (value instanceof Array ? value : [value])) {
								domUtils.append(el, child);
							}
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
				domUtils.append(el, val);
			}

			
			// uix component
			if (isComponent) {
				// set 'p' properties (contains options, other properties)
				propertyInitializer![INIT_PROPS](el);
				// trigger UIX lifecycle (onReplicate)
				type.construct(el, undefined, false, true);
			}
			
			return el;
		},

		serialize(val: Element&{[DOMUtils.EVENT_LISTENERS]?:Map<keyof HTMLElementEventMap, Set<Function>>}) {
			if (!(val instanceof this.class!)) throw "not an " + this.class!.name;
			const data: {style:Record<string,string>, content:any[], attr:Record<string,unknown>, shadowroot?:DocumentFragment} = {style: {}, attr: {}, content: []}

			// attributes
			for (let i = 0; i < val.attributes.length; i++) {
				const attrib = val.attributes[i];
				const value = attrib.value;
				// relative web path (@...)
				if (options?.mapFileURL && value.startsWith("file://")) data.attr[attrib.name] = options.mapFileURL(value as `file://${string}`);
				// default attr, ignore style + uix-ptr
				else if (attrib.name !== "style" && attrib.name !== "uix-ptr") data.attr[attrib.name] = value;
				
				// blob -> data url TODO: handle (async blob to base64)
				if (value.startsWith("blob:")) {
					logger.warn("todo: blob url attribute serialization")
					// val = await blobToBase64(val);
				}
			}

			// event handler attributes
			for (const [name, handlers] of val[DOMUtils.EVENT_LISTENERS]??[]) {
				const allowedHandlers = [];
				for (const handler of handlers) {
					// TODO
					// if (handler[STANDALONE]) logger.error("@standalone and UIX.inDisplayContext functions are currently not supported with UIX.renderDynamic/UIX.renderWithHydration ("+(handler.name??'anonymous function')+")")
					// else
					allowedHandlers.push($$(handler))
				}
				data.attr['on'+String(name)] = allowedHandlers;
			}

			// style (uix _original_style)
			// @ts-ignore 
			const style = val._original_style??val.style;
			
			let style_props = style._importants ? [...Object.keys(style._importants)] : style;
			if (style_props && !(style_props instanceof Array || (context.CSSStyleDeclaration && style_props instanceof context.CSSStyleDeclaration))) style_props = [...Object.keys(style_props)];


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
		class: context.HTMLElement
	}))

	Datex.Type.get('svg').setJSInterface(Object.assign(Object.create(elementInterface), {
		_name: 'svg',
		class: context.SVGElement
	}))

	Datex.Type.get('mathml').setJSInterface(Object.assign(Object.create(elementInterface), {
	    class: context.MathMLElement
	}))


	return {
		bindObserver
	}
}