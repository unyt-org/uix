import { Datex, always } from "unyt_core/datex.ts";
import { HTMLUtils } from "../html/utils.ts";
import { primitive } from "unyt_core/datex_all.ts";
import { logger } from "../uix_all.ts";

const LOCAL_VAR_PREFIX = '--uix-local-value-'
const GLOBAL_VAR_PREFIX = '--uix-global-value-'

type cssGeneratorFunction = (it:HTMLElement)=>string|number;
type cssParam = Datex.RefOrValue<primitive> | cssGeneratorFunction;

export interface DynamicCSSStyleSheet extends CSSStyleSheet {
	activate(document: Document|ShadowRoot): void
}

/**
 * Alternative to JSX, just using native JS template strings
 * @param template html template string
 * @param content 
 * @returns 
 */
export function SCSS(value:any): CSSStyleSheet
export function SCSS(template:TemplateStringsArray|string, ...params:cssParam[]): DynamicCSSStyleSheet
export function SCSS(template:any, ...params:cssParam[]) {
	const isTemplate = template?.raw instanceof Array && template instanceof Array;
	// non template value - convert to HTML node
	if (!isTemplate) {
		const styleSheet = new CSSStyleSheet()
		styleSheet.replaceSync(template)
		return styleSheet;
	}
	// template
	else {

		const globalCSSVars = new Map<string, any>();
		const localCSSVars = new Map<string, cssGeneratorFunction>();
		const cssVarsBySelector = new Map<string, Set<string>>();

		// combine css
		let css = "";
		let c = 0;
		const time = performance.now().toString().replace(".","");
		for (const raw of (template as unknown as TemplateStringsArray).raw) {
			css += raw;
			if (c<(template as unknown as TemplateStringsArray).raw.length-1) {
				// is (arrow) function - if no parameters passed (()=>...), it can be used as a global var, because there is no difference between elements
				if (typeof params[c] == "function" && !(params[c].toString().startsWith('()'))) {
					const name = `${LOCAL_VAR_PREFIX}${time}-${c}`;
					localCSSVars.set(name, params[c])
					css += `var(${name})`;
				}
				else {
					const name = `${GLOBAL_VAR_PREFIX}${time}-${c}`;
					globalCSSVars.set(name, params[c])
					css += `var(${name})`;
				}
			}
			c++;
		}
		// console.log("css",css)

		const styleSheet = new CSSStyleSheet() as DynamicCSSStyleSheet;
		styleSheet.replaceSync(css)
	
		// find injected values
		for (const styleRule of styleSheet.cssRules as unknown as ReadonlyArray<CSSStyleRule>) {
			cssVarsBySelector.set(styleRule.selectorText, getLocalVars(styleRule.style))
		}

		styleSheet.activate = (document: Document|ShadowRoot) => {
			logger.debug("activating stylesheet for", document)
			
			// enable stylesheet for document
			document.adoptedStyleSheets = [...(document.adoptedStyleSheets??[]), styleSheet];

			// set all global css vars for document
			for (const [prop, val] of globalCSSVars) {
				const evaluatedVal = typeof val == "function" ? always(val) : val;
				HTMLUtils.setCSSProperty((document as Document).documentElement ?? document, prop, evaluatedVal);
			}
			
			// set required local css vars for existing elements in document
			for (const [element, varName] of elementsDynamicProperties(iterateDOMTree(document), cssVarsBySelector)) {
				HTMLUtils.setCSSProperty(element, varName, always(()=>localCSSVars.get(varName)!(element)));
			}

			// observe when new child elements added
			const observer = new MutationObserver(mutations => {
				for (const [element, varName] of elementsDynamicProperties(iterateAddedNodes(mutations), cssVarsBySelector)) {
					HTMLUtils.setCSSProperty(element, varName, always(()=>localCSSVars.get(varName)!(element)));
				}
				// TODO: on remove
			});
			observer.observe(document, {childList: true, subtree: true})
			// TODO: unobserve function
		}


		return styleSheet
	}
	
}

function* elementsDynamicProperties(elements: Iterable<Element>, cssVarsBySelector: Map<string, Set<string>>) {
	// find all nodes that where added in mutation
	for (const element of elements) {
		// iterate over all possible selectors
		for (const selector of cssVarsBySelector.keys()) {
			// matching selector for a given element -> return element, prop, value
			if (element.matches(selector)) {
				const varNames = cssVarsBySelector.get(selector)!;
				for (const name of varNames) {
					yield [element, name] as const
				}
			}
		}
	}
}

function* iterateAddedNodes(mutations: MutationRecord[]) {
	for (const mut of mutations) {
		for (const parentNode of mut.addedNodes as unknown as ReadonlyArray<Node>) {
			for (const node of iterateDOMTree(parentNode)) {
				yield node;
			}
		}
	}
}

function* iterateDOMTree(node: Node): Generator<Element> {
	if (!(node instanceof Element || node instanceof DocumentFragment || node instanceof Document)) return;
	if (node instanceof Element) yield node;
	if (node.childNodes) {
		for (const childNode of node.childNodes as unknown as ReadonlyArray<ChildNode>) {
			for (const child of iterateDOMTree(childNode)) {
				yield child;
			}
		}
	}
}

function getLocalVars(styleDeclaration: CSSStyleDeclaration) {
	const varNames = new Set<string>()
	const inferredProperties = new Set<string>();

	for (let i=0; i<styleDeclaration.length; i++) {
		const property = styleDeclaration.item(i);

		if (property.startsWith("background-")) inferredProperties.add("background")
		if (property.startsWith("border-")) inferredProperties.add("border")
		if (property.startsWith("border-radius-")) inferredProperties.add("border-radius")

		const varName = extractVar(property, styleDeclaration);
		if (varName) varNames.add(varName);
	}

	for (const property of inferredProperties) {
		const varName = extractVar(property, styleDeclaration);
		if (varName) varNames.add(varName);
	}

	return varNames
}

function extractVar(property: string, styleDeclaration: CSSStyleDeclaration) {
	const value = styleDeclaration.getPropertyValue(property)
	if (value.includes('var('+LOCAL_VAR_PREFIX)) {
		const name = value.match(/var\((--uix-local-value-(?:[\d-]+))\)/)![1];
		return name;
	}
}