import { Datex } from "datex-core-legacy";
import { getCallerFile } from "datex-core-legacy/utils/caller_metadata.ts";
import { IS_TEMPLATE, SET_DEFAULT_ATTRIBUTES, SET_DEFAULT_CHILDREN } from "../uix-dom/jsx/parser.ts";
import { Component } from "../components/Component.ts";
import { DOMUtils } from "../uix-dom/datex-bindings/dom-utils.ts";
import { domContext, domUtils } from "../app/dom-context.ts";
import type { Element, Node, HTMLElement, HTMLTemplateElement } from "../uix-dom/dom/mod.ts";
import { defaultOptions, initDefaultOptions } from "../base/decorators.ts";
import type { Class } from "datex-core-legacy/utils/global_types.ts";
import { METADATA } from "datex-core-legacy/js_adapter/js_class_adapter.ts";

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
		for (const [event, listeners] of (<DOMUtils.elWithUIXAttributes>element)[DOMUtils.EVENT_LISTENERS]??[]) {
			for (const [listener] of listeners) {
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


type Props<Options extends Record<string,unknown>, Children, handleAllProps = true, optionalChildren = false> = JSX.DatexValueObject<Options> & 
(
	handleAllProps extends true ? 
		(JSX._IntrinsicAttributes & 
			(Equals<Children, undefined> extends true ? unknown : (Equals<Children, never> extends true ? unknown : (
				optionalChildren extends true ? 
					{children?: Children} :
					{children: Children}
			)
			)) // TODO: optional children for JSX, but not for template callback function
		) : unknown
)


type ObjectWithCollapsedValues<O extends Record<string, unknown>> = {
	[K in keyof O]: O[K] extends Datex.RefOrValue<infer T> ? T : O[K]
}

export type jsxInputGenerator<
	Return, 
	Options extends Record<string,unknown>, 
	Children, 
	handleAllProps = true, 
	optionalChildren = true, 
	Context extends HTMLElement = HTMLElement
> =
	(
		this: Context,
		props: Props<
			// inferred options:
			Context extends {options:unknown} ? Omit<(Context)['options'], '$'|'$$'> : Options
			, Children, handleAllProps, optionalChildren>,
		propsValues: ObjectWithCollapsedValues<Props<
			// inferred options:
			Context extends {options:unknown} ? Omit<(Context)['options'], '$'|'$$'> : Options
			, Children, handleAllProps, optionalChildren>>
	) => Return;


/**
 * Define an HTML template that can be used as an anonymous JSX component.
 * Default HTML Attributes defined in JSX are also set for the root element.
 * Custom Attributes can be handled in the generator
 * @example
 * ```tsx
 * const CustomComponent = template<{color:string}>(({color}) => <div class='class1 class2' style={{color}}></div>)
 * // create:
 * const comp = <CustomComponent id="c1" color="green"/>
 * ```
 * Per default, children are just appended to the root element of the template.
 * You can create a template with a shadow root by adding the 'shadow-root' attribute to the root element.
 * Children are appended to the <slot> element inside the root:
 * @example
 * ```tsx
 * const CustomComponent2 = template<{color:string}>(({color}) => 
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
export function template<
	Options extends Record<string, unknown> = Record<string,never>,
	Children = JSX.childrenOrChildrenPromise|JSX.childrenOrChildrenPromise[], 
	Context extends typeof HTMLElement = typeof HTMLElement
> (
	elementGenerator: jsxInputGenerator<JSX.Element|Promise<JSX.Element>, Options, never, false, false, InstanceType<Context>>
):
	jsxInputGenerator<JSX.Element|Promise<JSX.Element>, Options, Children>&((cl: Context, context: ClassDecoratorContext<Context>)=>any)

/**
 * Define an HTML template that can be used as an anonymous JSX component.
 * Default HTML Attributes defined in JSX are also set for the root element.
 * @example
 * ```tsx
 * const CustomComponent = template(<div class='class1 class2'></div>)
 * // create:
 * const comp = <CustomComponent id="c1"/>
 * ```
 * @param elementGenerator 
 */
export function template<Options extends Record<string, any> = {}, Children = JSX.childrenOrChildrenPromise|JSX.childrenOrChildrenPromise[]>(element:JSX.Element):jsxInputGenerator<JSX.Element, Options, Children>&((cl: Class, context: ClassDecoratorContext)=>any)

/**
 * Empty template for component
 * ```ts
 * @template()
 * class MyComponent extends Component {
 * }
 * ```
 * @param elementGenerator 
 */
export function template():jsxInputGenerator<JSX.Element, Record<string, never>, never>&((cl: Class, context: ClassDecoratorContext)=>any)


export function template(templateOrGenerator?:JSX.Element|jsxInputGenerator<JSX.Element|Promise<JSX.Element>, any, any, any>) {
	let generator:any;
	const module = getCallerFile();
	if (typeof templateOrGenerator == "function") generator = function(propsOrClass:any, context?:any) {
		// decorator
		if (Component.isPrototypeOf(propsOrClass)) {
			propsOrClass._init_module = module;
			// workaround: immediately set metadata for class
			(propsOrClass as any)[METADATA] = context.metadata;
			const decoratedClass = initDefaultOptions(module, propsOrClass)
			decoratedClass.template = generator
			return decoratedClass
		}
		// jsx
		else {

			const collapsedPropsProxy = new Proxy(propsOrClass??{}, {
				get(target,p) {
					return val(target[p]);
				},
			});

			if (context && templateOrGenerator.call) return templateOrGenerator.call(context, propsOrClass, collapsedPropsProxy)
			else return templateOrGenerator(propsOrClass, collapsedPropsProxy);

		}
	}
	else if (templateOrGenerator) {
		generator = function(maybeClass:any, context?:ClassDecoratorContext) {
			// decorator
			if (Component.isPrototypeOf(maybeClass)) {
				maybeClass._init_module = module;
				// workaround: immediately set metadata for class
				(maybeClass as any)[METADATA] = context.metadata;
				const decoratedClass = initDefaultOptions(module, maybeClass)
				decoratedClass.template = generator
				return decoratedClass
			}
			// jsx
			else {
				return cloneWithShadowRoots(templateOrGenerator);
			}
		}
	}
	else generator = function(maybeClass:any, context?:ClassDecoratorContext) {
		// decorator
		if (Component.isPrototypeOf(maybeClass)) {
			maybeClass._init_module = module;
			// workaround: immediately set metadata for class
			(maybeClass as any)[METADATA] = context.metadata;
			return initDefaultOptions(module, maybeClass)
		}
		// jsx
		else {
			throw new Error("invalid template definition")
		}
	};

	(generator as any)[SET_DEFAULT_ATTRIBUTES] = true;
	(generator as any)[SET_DEFAULT_CHILDREN] = true;
	(generator as any)[IS_TEMPLATE] = true;
	return generator;
}



/**
 * Define an HTML template that can be used as an anonymous JSX component.
 * 
 * `template` should be used instead of this function when possible. 
 * 
 * In contrast to `template`, children defined in JSX are not automatically appended to the root element of the template,
 * and HTML Attributes defined in JSX are also not automatically set for the root element.
 * 
 * All attributes and the children are available in the props argument of the generator function.
 * @example
 * ```tsx
 * const CustomComponent = blankTemplate<{color:string}>(({color, style, id, children}) => <div id={id} style={style}><h1>Header</h1>{...children}</div>)
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
export function blankTemplate<
	Options extends Record<string, any>,
	Children = JSX.childrenOrChildrenPromise|JSX.childrenOrChildrenPromise[], 
	Context extends typeof HTMLElement = typeof HTMLElement
> (
	elementGenerator: jsxInputGenerator<JSX.Element|Promise<JSX.Element>, Options, Children extends any[] ? Children : Children[], true, false, InstanceType<Context>>
): jsxInputGenerator<JSX.Element|Promise<JSX.Element>, Options, Children>&((cl: Context, context: ClassDecoratorContext<Context>)=>any) {
	const module = getCallerFile();

	function generator(propsOrClass:any) {

		// decorator
		if (Component.isPrototypeOf(propsOrClass)) {
			propsOrClass._init_module = module;
			const decoratedClass = initDefaultOptions(module, propsOrClass)
			decoratedClass.template = generator
			decoratedClass[SET_DEFAULT_CHILDREN] = false;
			return decoratedClass
		}

		else {
			const collapsedPropsProxy = new Proxy(propsOrClass??{}, {
				get(target,p) {
					return val(target[p])
				},
			});
	
			return elementGenerator(propsOrClass, collapsedPropsProxy);
		}

	}

	(generator as any)[IS_TEMPLATE] = true;
	return generator;
}

