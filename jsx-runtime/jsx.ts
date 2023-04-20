import { Path } from "unyt_node/path.ts";
import { $$, Datex } from "unyt_core";
import { UIX } from "uix";
import { getCallerFile } from "unyt_core/utils/caller_metadata.ts";
import { BaseComponent } from "../components/BaseComponent.ts";
import { validHTMLElementSpecificAttrs, validHTMLElementAttrs, validSVGElementSpecificAttrs, svgTags, mathMLTags } from "../html/attributes.ts";
import { HTMLUtils, logger } from "../uix_all.ts";


export function jsx (type: string | any, config: JSX.ElementChildrenAttribute): Element {

	let element:Element;
	let { children = [], ...props } = config
	if (!(children instanceof Array)) children = [children];


	let init_children = true;
	let init_attributes = true;

	if (typeof type === 'function') {
		// class extending HTMLElement
		if (HTMLElement.isPrototypeOf(type) || type === DocumentFragment || DocumentFragment.isPrototypeOf(type)) {
			element = new type(props) // uix component
			init_attributes = false;
		}
		else {
			element = type(config) // function
			// TODO:
			init_children = false;
			init_attributes = true;
		}
	}

	else if (type == "datex") {
		logger.warn("the <datex> JSX element only has experimental support")
		const placeholder = document.createElement("div");
		let dx = '';
		const dxData = [];
		for (const child of children) {
			if (typeof child == "string") dx += child;
			else {
				dx += Datex.INSERT_MARK; // (?)
				dxData.push(child);
			}
		}
		// TODO: DATEX spec, always create a new 'always' pointer if two pointers are added, multiplied, ...?
		dx = `always(${dx})`;

		// execute datex and set result as html content
		datex(dx, dxData).then(res=>{
			placeholder.replaceWith(UIX.HTMLUtils.valuesToDOMElement(res))
		});
		return placeholder;
	}

	else element = HTMLUtils.createElement(type);

	if (init_attributes) {
		for (let [key,val] of Object.entries(props)) {
			if (key == "style" && (element as HTMLElement).style) UIX.HTMLUtils.setCSS(element as HTMLElement, <any> val);
			else {
				if (typeof val == "string" && (val.startsWith("./") || val.startsWith("../"))) {
					// TODO: remove 'module'
					val = new Path(val, (<Record<string,any>>props)['module'] ?? (<Record<string,any>>props)['uix-module'] ?? getCallerFile()).toString();
				}
				UIX.HTMLUtils.setElementAttribute(element, key, <any>val, (<Record<string,any>>props)['module'] ?? (<Record<string,any>>props)['uix-module'] ?? getCallerFile());
			}
		}
	}

	if (init_children) {
		for (const child of children) {
			UIX.HTMLUtils.append(element, child);
		}
	}

	const makePtr = !!(<Record<string,any>>props)['datex-pointer'];
	// TODO: return here and only add pseudo pointer, without initializing the pointer
	// if (!makePtr) return element;

	// !important, cannot return directly because of stack problems, store in ptr variable first
	const ptr = $$(element);
	return ptr;
}

export function Fragment({children}:{children:Element[]}) {
	const fragment = new DocumentFragment();
	children.map(c=>HTMLUtils.append(fragment, c));
	return fragment;
}
 
// jsx.Fragment = jsxFragment
// jsx.TextNode = jsxTextNode
// jsx.customAttributes = ['children', 'key', 'props']

// TODO: handle separate
export const jsxs = jsx;

// @ts-ignore global jsx (required to work in standalone mode)
globalThis._jsx = jsx;

declare global {
	namespace JSX {
		// JSX node definition
		type Element = globalThis.Element

		// type ElementClass = typeof Element

		type Fragment = number;

		// Property that will hold the HTML attributes of the Component
		interface ElementAttributesProperty {
			props: Record<string,string>;
		}

		// Property in 'props' that will hold the children of the Component
		interface ElementChildrenAttribute {
			children: Element[]|Element
		}

		type _child = Datex.CompatValue<Element|DocumentFragment|string|number|boolean|bigint|null|child[]>;
		type child = _child|Promise<_child>

		type htmlAttrs<T extends Record<string,unknown>> = DatexValueObject<Omit<Partial<T>, 'children'|'style'>>

		// Common attributes of the standard HTML elements and JSX components
		type IntrinsicAttributes = {
			style?: Datex.CompatValue<string|Record<string,Datex.CompatValue<string|number>>>,
		} & htmlAttrs<validHTMLElementAttrs>

		// Common attributes of the UIX components only
		interface IntrinsicClassAttributes<C extends BaseComponent> {}

		type DatexValueObject<T extends Record<string|symbol,unknown>> = {
			[key in keyof T]: T[key] extends (...args:any)=>any ? T[key] : Datex.CompatValue<T[key]>
		}
		
		// HTML elements allowed in JSX, and their attributes definitions
		type IntrinsicElements = {
			readonly [key in keyof HTMLElementTagNameMap]: IntrinsicAttributes & {children?: child} & htmlAttrs<validHTMLElementSpecificAttrs<key>>
		} & {
			readonly [key in keyof SVGElementTagNameMap]: IntrinsicAttributes & {children?: child} & htmlAttrs<validSVGElementSpecificAttrs<key>>
		} & {
			datex: {children?: any} & {[key in keyof IntrinsicAttributes]: never}
		}
	}
  }
