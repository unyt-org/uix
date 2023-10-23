
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