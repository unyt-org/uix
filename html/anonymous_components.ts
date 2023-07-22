import { SET_DEFAULT_ATTRIBUTES, SET_DEFAULT_CHILDREN } from "../jsx-runtime/jsx.ts";
import { UIX } from "../uix.ts";
import { HTMLUtils } from "./utils.ts";
import { getCallerFile } from "unyt_core/utils/caller_metadata.ts";

/**
 * cloneNode(true), but also clones shadow roots.
 * @param element original element
 */
function cloneWithShadowRoots(element:Node) {
	if (!(element instanceof Element)) return element.cloneNode(true);

	function walk(node:Element, clone:Element) {
		const shadow = node.shadowRoot;
		if (shadow) {
		clone.attachShadow({ mode: shadow.mode }).append(...([].map.call(shadow.childNodes, (c:Node) => cloneWithListeners(c)) as Node[]));
		}
		for (let i=0; i<node.children.length; i++) walk(node.children[i], clone.children[i]);
	}
	const clone = cloneWithListeners(element) as Element;
	walk(element, clone);

	// add template content
	if (element instanceof HTMLTemplateElement) {
		for (const node of element.content.childNodes as unknown as Node[]) (clone as HTMLTemplateElement).content.append(cloneWithShadowRoots(node))
	}

	return clone;
}

/**
 * deep clone node, add listeners bound with [HTMLUtils.EVENT_LISTENERS]
 * @param element
 * @returns 
 */
function cloneWithListeners(element: Node) {
	// cannot use cloneNode(true) because listeners have to be copied for all children
	const clone = element.cloneNode(false);
	if (clone instanceof Element) {
		for (const [event, listeners] of (<HTMLUtils.elWithEventListeners>element)[HTMLUtils.EVENT_LISTENERS]??[]) {
			for (const listener of listeners) {
				HTMLUtils.setElementAttribute(clone, "on"+event, listener);
			}
		}	
	}
	// clone children
	for (const child of (element.childNodes as unknown as ChildNode[])) clone.appendChild(cloneWithListeners(child))
	return clone;	
}

type childrenToArray<ChildOrChildren> = ChildOrChildren extends Array<any> ? ChildOrChildren : [ChildOrChildren]

type Equals<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends
    (<T>() => T extends Y ? 1 : 2) ? true : false;

export type jsxInputGenerator<Return, Options extends Record<string,any>, Children, handleAllProps = true, childrenAsArray = false, Context = unknown> =
	(
		this: Context,
		props: JSX.DatexValueObject<Options> & 
			(
				handleAllProps extends true ? 
					(JSX.IntrinsicAttributes & 
						(Equals<Children, undefined> extends true ? unknown : (Equals<Children, never> extends true ? unknown : {children?: childrenAsArray extends true ? childrenToArray<Children> : Children}))
					) : unknown
			)
	) => Return;


/**
 * Define an HTML template that can be used as an anonymous JSX component.
 * Default HTML Attributes defined in JSX are also set for the root element.
 * Custom Attributes can be handled in the generator
 * @example
 * ```tsx
 * const CustomComponent = UIX.template<{color:string}>(({color}) => <div class='class1 class2' style={{color}}></div>)
 * // create:
 * const comp = <CustomComponent id="c1" color="green"/>
 * ```
 * Per default, children are just appended to the root element of the template.
 * You can create a template with a shadow root by adding the 'shadow-root' attribute to the root element.
 * Children are appended to the <slot> element inside the root:
 * @example
 * ```tsx
 * const CustomComponent2 = UIX.template<{color:string}>(({color}) => 
 * 	<div shadow-root>
 * 	    Custom content before children
 * 		<slot/>
 *      Custom content after children
 * 	</div>)
 * // create:
 * const comp2 = (
 * <CustomComponent2>
 *      <span>child 1</span>
 *      <span>child 2</span>
 * </CustomComponent2>
 * )
 * ```
 * @param elementGenerator 
 */
export function template<Options extends Record<string, any> = {}, Children = JSX.childrenOrChildrenPromise, Context = unknown>(elementGenerator:jsxInputGenerator<Element, Options, never, false, false, Context>):jsxInputGenerator<Element, Options, Children>&((cl:typeof HTMLElement)=>any)
/**
 * Define an HTML template that can be used as an anonymous JSX component.
 * Default HTML Attributes defined in JSX are also set for the root element.
 * @example
 * ```tsx
 * const CustomComponent = UIX.template(<div class='class1 class2'></div>)
 * // create:
 * const comp = <CustomComponent id="c1"/>
 * ```
 * @param elementGenerator 
 */
export function template<Options extends Record<string, any> = {}, Children = JSX.childrenOrChildrenPromise>(element:Element):jsxInputGenerator<Element, Options, Children>&((cl:typeof HTMLElement)=>any)

export function template(templateOrGenerator:Element|jsxInputGenerator<Element, any, any, any>) {
	let generator:any;
	const module = getCallerFile();

	if (typeof templateOrGenerator == "function") generator = function(propsOrClass:any, context?:any) {
		// decorator
		if (UIX.BaseComponent.isPrototypeOf(propsOrClass)) {
			propsOrClass._init_module = module;
			Component(propsOrClass).template = generator
		}
		// jsx
		else {
			if (context && templateOrGenerator.call) return templateOrGenerator.call(context, propsOrClass)
			else return templateOrGenerator(propsOrClass);
		}
	}
	else generator = function(propsOrClass:any) {

		// decorator
		if (UIX.BaseComponent.isPrototypeOf(propsOrClass)) {
			propsOrClass._init_module = module;
			Component(propsOrClass).template = generator
		}
		// jsx
		else {
			return cloneWithShadowRoots(templateOrGenerator);
		}
	};

	(generator as any)[SET_DEFAULT_ATTRIBUTES] = true;
	(generator as any)[SET_DEFAULT_CHILDREN] = true;
	return generator;
}

/**
 * Define an HTML template that can be used as an anonymous JSX component.
 * 
 * UIX.template should be used instead of this function when possible. 
 * 
 * In contrast to UIX.template, children defined in JSX are not automatically appended to the root element of the template,
 * and HTML Attributes defined in JSX are also not automatically set for the root element.
 * 
 * All attributes and the children are available in the props argument of the generator function.
 * @example
 * ```tsx
 * const CustomComponent = UIX.blankTemplate<{color:string}>(({color, style, id, children}) => <div id={id} style={style}><h1>Header</h1>{...children}</div>)
 * // create:
 * const comp = (
 * <CustomComponent id="c1">
 *     <div>first child</div>
 *     <div>second child</div>
 * </CustomComponent>
 * )
 * ```
 * @param elementGenerator 
 */
export function blankTemplate<Options extends Record<string, any>, Children = JSX.childrenOrChildrenPromise>(elementGenerator:jsxInputGenerator<Element, Options, Children, true, true>):jsxInputGenerator<Element, Options, Children> {
	return function(props:any) {
		return elementGenerator(props) 
	}
}



export function style<Options extends Record<string, any> = {}, Children = JSX.childrenOrChildrenPromise, Context = unknown>(styleGenerator:jsxInputGenerator<CSSStyleSheet, Options, never, false, false, Context>):jsxInputGenerator<CSSStyleSheet, Options, Children>&((cl:typeof HTMLElement)=>any)

export function style<Options extends Record<string, any> = {}, Children = JSX.childrenOrChildrenPromise>(style:CSSStyleSheet):jsxInputGenerator<CSSStyleSheet, Options, Children>&((cl:typeof HTMLElement)=>any)

export function style(templateOrGenerator:CSSStyleSheet|jsxInputGenerator<CSSStyleSheet, any, any, any>) {
	let generator:any;
	const module = getCallerFile();

	if (typeof templateOrGenerator == "function") generator = function(propsOrClass:any, context?:any) {
		// decorator
		if (UIX.BaseComponent.isPrototypeOf(propsOrClass)) {
			propsOrClass._init_module = module;
			propsOrClass.style_template = generator
		}
		// jsx
		else {
			if (context && templateOrGenerator.call) return templateOrGenerator.call(context, propsOrClass)
			else return templateOrGenerator(propsOrClass);
		}
	}
	else generator = function(propsOrClass:any) {

		// decorator
		if (UIX.BaseComponent.isPrototypeOf(propsOrClass)) {
			propsOrClass._init_module = module;
			propsOrClass.style_template = generator
		}
		// jsx
		else {
			return templateOrGenerator;
		}
	};

	return generator;

}