import { Path } from "unyt_node/path.ts";
import { $$, Datex } from "unyt_core";
import { UIX } from "uix";
import { getCallerFile } from "unyt_core/utils/caller_metadata.ts";
import { BaseComponent } from "../components/BaseComponent.ts";
import { validElementAttrs, validHTMLElementAttrs } from "../html/attributes.ts";

// const jsxFragment = 'jsx.Fragment'
// const jsxTextNode = 'jsx.Text'

// type jsxDOMContainer = HTMLElement | DocumentFragment | null
// type jsxDOMElement = HTMLElement | DocumentFragment | Text

export function jsx (type: string | any, config: JSX.ElementChildrenAttribute): HTMLElement {

	let element:HTMLElement;
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
	else element = <HTMLElement> document.createElement(type);

	if (init_attributes) {
		for (let [key,val] of Object.entries(props)) {
			if (key == "style") UIX.HTMLUtils.setCSS(element, <any> val);
			else {
				if (typeof val == "string" && (val.startsWith("./") || val.startsWith("../"))) {
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

	// !important, cannot return directly because of stack problems, store in ptr variable first
	const ptr = $$(element);
	return ptr;
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
		type Element = HTMLElement

		// type ElementClass = typeof HTMLElement

		type Fragment = number;

		// Property that will hold the HTML attributes of the Component
		interface ElementAttributesProperty {
			props: Record<string,string>;
		}

		// Property in 'props' that will hold the children of the Component
		interface ElementChildrenAttribute {
			children: HTMLElement[]|HTMLElement
		}

		type child = Datex.CompatValue<HTMLElement|string|number|boolean|bigint|null|child[]>

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
			readonly [key in keyof HTMLElementTagNameMap]: IntrinsicAttributes & {children?: child} & htmlAttrs<validElementAttrs<key>>
		}
	}
  }
