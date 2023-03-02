import { $$ } from "unyt_core";
import { Utils } from "../base/utils.ts";

const jsxFragment = 'jsx.Fragment'
const jsxTextNode = 'jsx.Text'

type jsxDOMContainer = HTMLElement | DocumentFragment | null
type jsxDOMElement = HTMLElement | DocumentFragment | Text

export function jsx (type: string | any, config: JSX.ElementChildrenAttribute): HTMLElement {

	if (typeof type === 'function') {
		if (type.prototype !== undefined) {
			return new type(config)
		}
		return type(config)
	}

	let { children = [], ...props } = config

	if (!(children instanceof Array)) children = [children];

	const element = <HTMLElement> document.createElement(type);

	for (const [key,val] of Object.entries(props)) {
		Utils.setElementAttribute(element, key, val);
	}

	// console.log("jsx", type, children, props)

	for (const child of children) {
		Utils.append(element, child);
	}

	// !important, cannot return directly because of stack problems, store in ptr variable first
	const ptr = $$(element);
	return ptr;
}

jsx.Fragment = jsxFragment
jsx.TextNode = jsxTextNode
jsx.customAttributes = ['children', 'key', 'props']

// TODO: handle separate
export const jsxs = jsx;


declare global {
	namespace JSX {
	  // JSX node definition
	  type Element = HTMLElement

	  interface ElementClass extends HTMLElement {

	  }
    
	  // Property that will hold the HTML attributes of the Component
	  interface ElementAttributesProperty {
		props: {};
	  }
  
	  // Property in 'props' that will hold the children of the Component
	  interface ElementChildrenAttribute {
		children: HTMLElement[]
	  }
  
	  // Common attributes of the standard HTML elements and JSX components
	  interface IntrinsicAttributes {
		class?: string
		id?: string,
		style?: string,
		name?: string,

		[key: string]: any
	  }
  
	  // Common attributes of the UIX components only
	  interface IntrinsicClassAttributes<ComponentClass> {
  
	  }
  
	  // HTML elements allowed in JSX, and their attributes definitions
	  type IntrinsicElements = {
		[key in keyof HTMLElementTagNameMap]: IntrinsicAttributes
	  }
	}
  }
