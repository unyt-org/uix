import { Datex } from "datex-core-legacy";
import { getCallerFile } from "datex-core-legacy/utils/caller_metadata.ts";
import { SET_DEFAULT_ATTRIBUTES, SET_DEFAULT_CHILDREN } from "../uix-dom/jsx/parser.ts";
import { Component } from "../components/Component.ts";
import { DOMUtils } from "../uix-dom/datex-bindings/dom-utils.ts";
import { domContext, domUtils } from "../app/dom-context.ts";
import type { Element, Node, HTMLElement, HTMLTemplateElement, CSSStyleSheet } from "../uix-dom/dom/mod.ts";
import { defaultOptions } from "../base/decorators.ts";

/**
 * cloneNode(true), but also clones shadow roots.
 * @param element original element
 */
function cloneWithShadowRoots(element:Node) {
	if (!(element instanceof domContext.Element)) return element.cloneNode(true);

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
	if (element instanceof domContext.HTMLTemplateElement) {
		for (const node of element.content.childNodes as unknown as Node[]) (clone as HTMLTemplateElement).content.append(cloneWithShadowRoots(node))
	}

	return clone;
}

/**
 * deep clone node, add listeners bound with [DOMUtils.EVENT_LISTENERS]
 * @param element
 * @returns 
 */
function cloneWithListeners(element: Node) {
	// cannot use cloneNode(true) because listeners have to be copied for all children
	const clone = element.cloneNode(false);
	if (clone instanceof domContext.Element) {
		for (const [event, listeners] of (<DOMUtils.elWithEventListeners>element)[DOMUtils.EVENT_LISTENERS]??[]) {
			for (const listener of listeners) {
				domUtils.setElementAttribute(clone, "on"+event, listener);
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


type Props<Options extends Record<string,unknown>, Children, handleAllProps = true> = JSX.DatexValueObject<Options> & 
(
	handleAllProps extends true ? 
		(JSX._IntrinsicAttributes & 
			(Equals<Children, undefined> extends true ? unknown : (Equals<Children, never> extends true ? unknown : {children?: Children}))
		) : unknown
)

type ObjectWithCollapsedValues<O extends Record<string, unknown>> = {
	[K in keyof O]: O[K] extends Datex.RefOrValue<infer T> ? T : O[K]
}

export type jsxInputGenerator<Return, Options extends Record<string,unknown>, Children, handleAllProps = true, childrenAsArray = false, Context = unknown> =
	(
		this: Context,
		props: Props<Options, Children, handleAllProps>,
		propsValues: ObjectWithCollapsedValues<Props<Options, Children, handleAllProps>>
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
export function template<Options extends Record<string, any> = {}, Children = JSX.childrenOrChildrenPromise|JSX.childrenOrChildrenPromise[], Context = unknown>(elementGenerator:jsxInputGenerator<Element, Options, never, false, false, Context>):jsxInputGenerator<Element, Options, Children>&((cl:typeof HTMLElement)=>any)
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
export function template<Options extends Record<string, any> = {}, Children = JSX.childrenOrChildrenPromise|JSX.childrenOrChildrenPromise[]>(element:Element):jsxInputGenerator<Element, Options, Children>&((cl:typeof HTMLElement)=>any)

export function template(templateOrGenerator:Element|jsxInputGenerator<Element, any, any, any>) {
	let generator:any;
	const module = getCallerFile();
	if (typeof templateOrGenerator == "function") generator = function(propsOrClass:any, context?:any) {
		// decorator
		if (Component.isPrototypeOf(propsOrClass)) {
			propsOrClass._init_module = module;
			const decoratedClass = defaultOptions(propsOrClass)
			decoratedClass.template = generator
			return decoratedClass
		}
		// jsx
		else {

			const collapsedPropsProxy = new Proxy(propsOrClass, {
				get(target,p) {
					return val(target[p])
				},
			});

			if (context && templateOrGenerator.call) return templateOrGenerator.call(context, propsOrClass, collapsedPropsProxy)
			else return templateOrGenerator(propsOrClass, collapsedPropsProxy);
		}
	}
	else generator = function(maybeClass:any) {

		// decorator
		if (Object.isPrototypeOf(maybeClass)) {
			maybeClass._init_module = module;
			const decoratedClass = defaultOptions(maybeClass)
			decoratedClass.template = generator
			return decoratedClass
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
export function blankTemplate<Options extends Record<string, any>, Children = JSX.childrenOrChildrenPromise|JSX.childrenOrChildrenPromise[]>(elementGenerator:jsxInputGenerator<Element, Options, Children, true, true>):jsxInputGenerator<Element, Options, Children>&((cl:typeof HTMLElement)=>any) {
	return function(props:any) {
		const collapsedPropsProxy = new Proxy(props, {
			get(target,p) {
				return val(target[p])
			},
		});

		return elementGenerator(props, collapsedPropsProxy);
	}
}


/**
 * \@style decorator
 * 
 * Can be used to define an inline style generator for a component:
 * 
 * ```tsx
 * ;@style<{color:string}>(({color}) => SCSS `
 *   #main {
 *     background-color: ${color};
 *   }
 * `)
 * class MyComponent extends Component {...}
 * ```
 * @param styleGenerator 
 */
export function style<Options extends Record<string, any> = {}, Children = JSX.childrenOrChildrenPromise|JSX.childrenOrChildrenPromise[], Context = unknown>(styleGenerator:jsxInputGenerator<CSSStyleSheet, Options, never, false, false, Context>):jsxInputGenerator<CSSStyleSheet, Options, Children>&((cl:typeof HTMLElement)=>any)

/**
 * \@style decorator
 * 
 * Can be used to define inline styles for a component:
 * 
 * ```tsx
 * ;@style(SCSS `
 *   #main {
 *     background-color: magenta;
 *   }
 * `)
 * class MyComponent extends Component {...}
 * ```
 * @param styleGenerator 
 */
export function style(style:CSSStyleSheet):((cl:typeof HTMLElement)=>any)

/**
 * \@style decorator
 * 
 * Can be used to define an external style sheet for a component:
 *
 * ```tsx
 * ;@style("./my-style.scss")
 * class MyComponent extends Component {...}
 * ```
 * @param styleGenerator 
 */
export function style(file:string|URL):((cl:typeof HTMLElement)=>any)


export function style(templateOrGenerator:string|URL|CSSStyleSheet|jsxInputGenerator<CSSStyleSheet, any, any, any>) {
	let generator:any;
	const module = getCallerFile();

	// string to url
	if (typeof templateOrGenerator == "string") templateOrGenerator = new URL(templateOrGenerator, module)

	// generator function
	if (typeof templateOrGenerator == "function") generator = function(propsOrClass:any, context?:any) {
		// decorator
		if (Component.isPrototypeOf(propsOrClass)) {
			propsOrClass._init_module = module;
			if (!propsOrClass.style_templates) propsOrClass.style_templates = new Set()
			propsOrClass.style_templates.add(generator)
		}
		// evaluate
		else {

			const collapsedPropsProxy = new Proxy(propsOrClass, {
				get(target,p) {
					return val(target[p])
				},
			});

			if (context && (templateOrGenerator as Function).call) return (templateOrGenerator as Function).call(context, propsOrClass, collapsedPropsProxy)
			else return (templateOrGenerator as Function)(propsOrClass, collapsedPropsProxy);
		}
	}

	// CSSStyleSheet or URL/string
	else generator = function (propsOrClass:any) {

		// decorator
		if (Component.isPrototypeOf(propsOrClass)) {
			propsOrClass._init_module = module;
			if (!propsOrClass.style_templates) propsOrClass.style_templates = new Set()
			propsOrClass.style_templates.add(generator)
		}
		// evaluate
		else {
			return templateOrGenerator;
		}
	}

	return generator;
}