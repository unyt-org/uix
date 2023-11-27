import { Datex } from "datex-core-legacy";
import type { primitive } from "datex-core-legacy/datex_all.ts";
import { domContext, domUtils } from "../app/dom-context.ts";
import { logger } from "./global-values.ts";
import { always } from "datex-core-legacy";
import type { CSSStyleDeclaration, CSSStyleRule, CSSStyleSheet, Document, Element, HTMLElement, Node, ShadowRoot } from "../uix-dom/dom/mod.ts";


const LOCAL_VAR_PREFIX = '--uix-local-value-'
const GLOBAL_VAR_PREFIX = '--uix-global-value-'

type cssGeneratorFunction = (it:HTMLElement)=>string|number;
type cssParam = Datex.RefOrValue<primitive> | cssGeneratorFunction;

export interface DynamicCSSStyleSheet extends CSSStyleSheet {
	activate(document: Document|ShadowRoot): void
}

/**
 * Define reactive (S)CSS style sheets with JS template strings
 * @param template css template string
 * @returns 
 */
export function SCSS(template:TemplateStringsArray|string, ...params:cssParam[]): DynamicCSSStyleSheet {
	const isTemplate = (template as TemplateStringsArray)?.raw instanceof Array && template instanceof Array;
	// non template value - convert to HTML node
	if (!isTemplate) {
		const styleSheet = new domContext.CSSStyleSheet() as DynamicCSSStyleSheet;
		styleSheet.replaceSync(template as string)
		styleSheet.activate = () => {} // no activation needed for static style sheet
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

		const styleSheet = new domContext.CSSStyleSheet() as DynamicCSSStyleSheet;
		styleSheet.replaceSync(css)
	
		// find injected values
		for (const styleRule of styleSheet.cssRules as unknown as ReadonlyArray<CSSStyleRule>) {
			cssVarsBySelector.set(styleRule.selectorText, getLocalVars(styleRule.style))
		}

		const activatedFor = new Set<Document|ShadowRoot>();

		styleSheet.activate = (document: Document|ShadowRoot) => {
			if (activatedFor.has(document)) return;
			activatedFor.add(document);
			logger.debug("activating stylesheet")
			
			// enable stylesheet for document
			document.adoptedStyleSheets = [...(document.adoptedStyleSheets??[]), styleSheet];

			// set all global css vars for document
			for (const [prop, val] of globalCSSVars) {
				const evaluatedVal = typeof val == "function" ? always(val) : val;
				domUtils.setCSSProperty((document as Document).documentElement ?? document, prop, evaluatedVal);
			}
			
			// set required local css vars for existing elements in document
			for (const [element, varName] of elementsDynamicProperties(iterateDOMTree(document), cssVarsBySelector)) {
				domUtils.setCSSProperty(element, varName, always(()=>localCSSVars.get(varName)!(element)));
			}

			// observe when new child elements added
			const observer = new domContext.MutationObserver(mutations => {
				for (const [element, varName] of elementsDynamicProperties(iterateAddedNodes(mutations), cssVarsBySelector)) {
					domUtils.setCSSProperty(element, varName, always(()=>localCSSVars.get(varName)!(element)));
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
	if (!(node instanceof domContext.Element || node instanceof domContext.DocumentFragment || node instanceof domContext.Document)) return;
	if (node instanceof domContext.Element) yield node;
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