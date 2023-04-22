import { Path } from "unyt_node/path.ts";
import { $$, Datex } from "unyt_core";
import { UIX } from "uix";
import { getCallerFile } from "unyt_core/utils/caller_metadata.ts";
import { BaseComponent } from "../components/BaseComponent.ts";
import { validHTMLElementSpecificAttrs, validHTMLElementAttrs, validSVGElementSpecificAttrs, svgTags, mathMLTags } from "../html/attributes.ts";
import { HTMLUtils, logger } from "../uix_all.ts";

export const SET_DEFAULT_ATTRIBUTES: unique symbol = Symbol("SET_DEFAULT_ATTRIBUTES");
export const SET_DEFAULT_CHILDREN: unique symbol = Symbol("SET_DEFAULT_CHILDREN");

export function jsx (type: string | any, config: Record<string,any>): Element {

	let element:Element;
	if (!(config.children instanceof Array)) config.children = [config.children];
	const { children = [], ...props } = config

	let set_default_children = true;
	let set_default_attributes = true;
	let allow_invalid_attributes = true;

	let shadow_root = false;
	if (props['shadow-root']) {
		shadow_root = props['shadow-root']==true?'open':props['shadow-root'];
		delete props['shadow-root'];
	}
	
	if (typeof type === 'function') {

		// class component
		if (HTMLElement.isPrototypeOf(type) || type === DocumentFragment || DocumentFragment.isPrototypeOf(type)) {
			set_default_children = (type as any)[SET_DEFAULT_CHILDREN] ?? true;
			set_default_attributes = (type as any)[SET_DEFAULT_ATTRIBUTES] ?? true;
			if (set_default_children) delete config.children;

			element = new type(props) // uix component
		}
		// function component
		else {
			set_default_children = (type as any)[SET_DEFAULT_CHILDREN];
			set_default_attributes = (type as any)[SET_DEFAULT_ATTRIBUTES];
			if (set_default_children) delete config.children;

			element = type(config) 
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

	else {
		allow_invalid_attributes = false;
		
		// convert shadow-root to template
		if (type == "shadow-root") {
			type = "template"
			props.shadowrootmode = props.mode ?? "open";
			delete props.mode
		}
		
		element = HTMLUtils.createElement(type);
	}

	if (set_default_attributes) {
		for (let [attr,val] of Object.entries(props)) {
			if (attr == "style" && (element as HTMLElement).style) UIX.HTMLUtils.setCSS(element as HTMLElement, <any> val);
			else {
				if (typeof val == "string" && (val.startsWith("./") || val.startsWith("../"))) {
					// TODO: remove 'module'
					val = new Path(val, (<Record<string,any>>props)['module'] ?? (<Record<string,any>>props)['uix-module'] ?? getCallerFile()).toString();
				}
				const valid_attr = UIX.HTMLUtils.setElementAttribute(element, attr, <any>val, (<Record<string,any>>props)['module'] ?? (<Record<string,any>>props)['uix-module'] ?? getCallerFile());
				if (!allow_invalid_attributes && !valid_attr) throw new Error(`Element attribute "${attr}" is not allowed for <${element.tagName.toLowerCase()}>`)
			}
		}
	}

	if (set_default_children) {
		if (shadow_root) {
			const template = jsx("template", {children, shadowrootmode:shadow_root});
			UIX.HTMLUtils.append(element, template);
		}
		else {
			UIX.HTMLUtils.append(element, ...children);
		}
		
	}

	// TODO: datex-pointer false default?
	const makePtr = (<Record<string,any>>props)['datex-pointer'] == true || (<Record<string,any>>props)['datex-pointer'] == undefined;
	// TODO: add pseudo pointer id attr, without initializing the pointer
	if (!makePtr) return element;

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

		type singleChild = Datex.CompatValue<Element|DocumentFragment|string|number|boolean|bigint|null|undefined>;
		type singleOrMultipleChildren = singleChild|singleChild[];
		type childrenOrChildrenPromise = singleOrMultipleChildren|Promise<singleOrMultipleChildren>
		// enable as workaround to allow {...[elements]} type checking to work correctly
		// type childrenOrChildrenPromise = _childrenOrChildrenPromise|_childrenOrChildrenPromise[]

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
		
		type IntrinsicElements = 
		// html elements
		{
			readonly [key in keyof HTMLElementTagNameMap]: IntrinsicAttributes & {children?: childrenOrChildrenPromise} & htmlAttrs<validHTMLElementSpecificAttrs<key>>
		} 
		// svg elements
		& {
			readonly [key in keyof SVGElementTagNameMap]: IntrinsicAttributes & {children?: childrenOrChildrenPromise} & htmlAttrs<validSVGElementSpecificAttrs<key>>
		} 
		// other custom elements
		& {
			// inject datex script, returned value is inserted into the dom
			datex: {children?: any} & {[key in keyof IntrinsicAttributes]: never},
			'shadow-root': {children?: childrenOrChildrenPromise} & {[key in keyof IntrinsicAttributes]: never} & {mode?:'open'|'closed'}
		}
	}
  }
