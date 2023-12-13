import { Datex } from "datex-core-legacy";
import { OpenGraphInformation } from "../base/open-graph.ts";
import { indent } from "datex-core-legacy/utils/indent.ts";
import type { HTMLProvider } from "./html-provider.ts";
import { COMPONENT_CONTEXT, STANDALONE } from "../standalone/bound_content_properties.ts";
import { app } from "../app/app.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { bindToOrigin, getValueUpdater } from "../app/datex-over-http.ts";
import { RenderMethod } from "../base/render-methods.ts";
import { logger } from "../utils/global-values.ts";
import { domContext, domUtils } from "../app/dom-context.ts";
import { DOMUtils } from "../uix-dom/datex-bindings/dom-utils.ts";
import { JSTransferableFunction } from "datex-core-legacy/types/js-function.ts";
import { Element, HTMLFormElement } from "../uix-dom/dom/mod.ts";
import { blobToBase64 } from "../uix-dom/datex-bindings/blob-to-base64.ts";
import { convertToWebPath } from "../app/convert-to-web-path.ts";
import { UIX } from "../../uix.ts";
import { serializeJSValue } from "../utils/serialize-js.ts";
import { Component } from "../components/Component.ts";
import { DX_VALUE } from "datex-core-legacy/runtime/constants.ts";

let stage:string|undefined = '?'

if (client_type === "deno") {
	({ stage } = (await import("../app/args.ts")))
}

type injectScriptData = {declare:Record<string,string>, init:string[]};

type _renderOptions = {includeShadowRoots?:boolean, injectStandaloneComponents?: boolean, forms?:string[], datex_update_type?:string[], _injectedJsData?:injectScriptData, lang?:string, allowIgnoreDatexFunctions?: boolean}

export const CACHED_CONTENT = Symbol("CACHED_CONTENT");

const selfClosingTags = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr"
])


function loadStandaloneJS(el:(Element|ShadowRoot) & {standaloneEnabled?:()=>boolean}, opts?:_renderOptions){
	// is UIX component with standalone methods?
	if (opts?._injectedJsData && opts?.injectStandaloneComponents && el.standaloneEnabled?.()) {
		// add all class declarations
		loadClassDeclarations(<any>el.constructor, opts._injectedJsData);
		// add init script for instance
		loadInitScript(el, opts._injectedJsData);
	}
}

function loadClassDeclarations(componentClass: (typeof Element| typeof ShadowRoot) & {getParentClass?:()=>typeof HTMLElement|null, getStandalonePseudoClass?:()=>string}, _injectedJsData:injectScriptData) {
	// no valid component
	if (!componentClass.getStandalonePseudoClass || !componentClass.getParentClass) return;
	
	// add parent class?
	const parent_class = componentClass.getParentClass()
	if (parent_class) loadClassDeclarations(<any>parent_class, _injectedJsData);

	const name = componentClass.name;
	if (!_injectedJsData.declare[name]) {
		_injectedJsData.declare[name] = componentClass.getStandalonePseudoClass();
	}
}

function loadInitScript(component:(Element|ShadowRoot) & {getStandaloneInit?:()=>string}, _injectedJsData:injectScriptData) {
	if (component.getStandaloneInit) {
		_injectedJsData.init.push(component.getStandaloneInit());
	}
}

export function getInnerHTML(el:Element|ShadowRoot, opts?:_renderOptions, collectedStylesheets?:string[], standaloneContext = false) {
	if (!opts?.includeShadowRoots) return el.innerHTML;

	let html = "";

	// load js (into opts._injectedJsData) if UIX component with standalone methods
	loadStandaloneJS(el, opts);

	// add shadow root
	if (el instanceof domContext.Element && el.shadowRoot) {
		html += `<template shadowrootmode="${el.shadowRoot.mode??"open"}">`
		// collect stylsheets that children require
		const collectedStylesheets:string[] = []
		html += getInnerHTML(el.shadowRoot, opts, collectedStylesheets, standaloneContext);
		for (const link of collectedStylesheets) html += `<link rel="stylesheet" href="${convertToWebPath(link)}">\n`;
		// @ts-ignore
		if (el.getRenderedStyle) html += el.getRenderedStyle();
		html += '</template>'
	}

	else {
		// @ts-ignore
		if (el.style_sheets_urls && collectedStylesheets) collectedStylesheets.push(...el.style_sheets_urls)
		// @ts-ignore
		if (el.activatedScopedStyles && collectedStylesheets) collectedStylesheets.push(...el.activatedScopedStyles)
	}

	for (const child of (el.childNodes as unknown as Node[])) {
		html += _getOuterHTML(child, opts, collectedStylesheets, standaloneContext);
	}

	return html || domUtils.escapeHtml((el as HTMLElement).innerText ?? ""); // TODO: why sometimes no childnodes in jsdom (e.g UIX.Elements.Button)
}

function _getOuterHTML(el:Node, opts?:_renderOptions, collectedStylesheets?:string[], isStandaloneContext = false):string {
	isStandaloneContext = isStandaloneContext || (<any>el)[STANDALONE];

	// TODO: also for attributes
	if (opts?.lang) {
		for (const childPtr of (el as DOMUtils.elWithEventListeners)[DOMUtils.CHILDREN_DX_VALUES]??[]) {
			if (childPtr.transformSource) {
				for (const ptr of [...childPtr.transformSource.deps, ...childPtr.transformSource.keyedDeps.keys()]) {
					if (ptr instanceof Datex.Pointer && ptr.transformMap) {
						const localizedValue = ptr.transformMap[opts.lang] ?? ptr.transformMap["en"];
						if (localizedValue != undefined) ptr.val = localizedValue;
					}
				}
				childPtr.transformSource.update();
			}
		}
	}
	

	if (el instanceof domContext.Text) {
		// localized
		let content: string; 
		if (opts?.lang && (el as any)[DX_VALUE] instanceof Datex.Pointer && (el as any)[DX_VALUE].transformMap) {
			const map = (el as any)[DX_VALUE].transformMap;
			content = map[opts?.lang] ?? map["en"] ?? el.textContent;
		}
		// not localized
		else {
			content = el.textContent
		}
		return domUtils.escapeHtml(content ?? ""); // text node
	}

	if (el instanceof domContext.DocumentFragment) {
		const content = [];
		for (const child of (el.childNodes as unknown as Node[])) {
			content.push(_getOuterHTML(child, opts, collectedStylesheets, isStandaloneContext));
		}
		return content.join("\n");
	}

	if (el instanceof domContext.Comment) {
		return `<!--${el.textContent}-->`
	}

	// invalid node/element
	if (!(el instanceof domContext.Element)) {
		console.log("cannot render node",el);
		throw "invalid HTML node"
	}

	const dataPtr:string = el.attributes.getNamedItem("uix-ptr")?.value;

	// add datex-update type to stack
	const datexUpdateType = (el as any)[DOMUtils.DATEX_UPDATE_TYPE];
	if (opts && datexUpdateType) {
		if (!opts.datex_update_type) opts.datex_update_type = []
		opts.datex_update_type.push(datexUpdateType)
	}

	// remember last form
	if (el instanceof domContext.HTMLFormElement) {
		if (!opts.forms) opts.forms = []
		opts.forms.push(dataPtr)
	}

	const inner = getInnerHTML(el, opts, collectedStylesheets, isStandaloneContext);
	const tag = el.tagName.toLowerCase();
	const attrs = [];
	
	// pop datex-update type from stack
	if (opts && datexUpdateType) {
		opts.datex_update_type?.pop()
	}
	// pop last form
	if (el instanceof domContext.HTMLFormElement) {
		opts.forms?.pop()
	}


	// TODO: only workaround
	// if (opts?.lang) {
	// 	UIX.language = opts.lang
	// };



	for (let i = 0; i < el.attributes.length; i++) {
		const attrib = el.attributes[i];
		let val:string;

		const transformMap = opts?.lang && (el as any)[DOMUtils.ATTR_DX_VALUES]?.get(attrib.name)?.transformMap;
		if (transformMap) {
			val = transformMap[opts!.lang!] ?? transformMap["en"] ?? attrib.value;
		}
		else {
			val = attrib.value;
		}

		// relative web path (@...)
		if (val.startsWith("file://")) val = convertToWebPath(val);
		// blob -> data url
		else if (val.startsWith("blob:")) {
			logger.warn("not implemented: ssr blob rendering support");
			// val = await blobToBase64(val);
		}

		attrs.push(`${attrib.name}="${domUtils.escapeHtml(val.toString())}"`) // TODO: better escape?
	}


	// special attributes (value, checked)
	if ('value' in el && el.value) attrs.push(`value="${domUtils.escapeHtml(el.value?.toString()??"")}"`)
	if ('checked' in el) {
		if (el.checked === true) attrs.push(`checked`)
		else if (el.checked !== false) attrs.push(`value="${domUtils.escapeHtml(el.checked?.toString()??"")}"`)
	}

	// hydratable
	if (isLiveNode(el)) attrs.push("uix-dry");
	// just static
	else attrs.push("uix-static");

	// inject event listeners
	if (dataPtr && opts?._injectedJsData && ((<DOMUtils.elWithEventListeners>el)[DOMUtils.EVENT_LISTENERS] || (<DOMUtils.elWithEventListeners>el)[DOMUtils.PSEUDO_ATTR_BINDINGS])) {
		let context: HTMLElement|undefined;
		let parent: Element|null = el;
		let hasScriptContent = false; // indicates whether the generated script actually contains relevant content, not just skeleton code
		do {
			const ctx = <HTMLElement|undefined>(<any>parent)[COMPONENT_CONTEXT];
			if (ctx) {
				context = ctx;
				break;
			}
		} while ((parent = parent?.parentElement));


		let script = `const el = querySelector('[uix-ptr="${dataPtr}"]');\n`
		script += `el[EVENT_LISTENERS] ??= new Map();\n`

		// inject listeners
		for (const [event, listeners] of (<DOMUtils.elWithEventListeners>el)[DOMUtils.EVENT_LISTENERS] ?? []) {
			
			for (const [listener] of listeners) {

				const listenerFn = getFunctionWithContext(listener, isStandaloneContext);

				// special form "action" on submit (no js required)
				if (event == "submit" && Datex.Pointer.getByValue(listenerFn)) {
					attrs.push(`action="/@uix/form-action/${Datex.Pointer.getByValue(listenerFn)!.idString()}/"`);
				} 

				// normal event listener
				else {
					hasScriptContent = true;
					const eventName = String(event);
					try {
						const fnSource = getFunctionSource(listener, isStandaloneContext)
						script += `{\n`
						script += fnSource.companionSource;
						script += `const __f__ = ${fnSource.source};\n`;
						script += `if (!el[EVENT_LISTENERS].has("${eventName}")) el[EVENT_LISTENERS].set("${eventName}", new Set());\n`;
						script += `el[EVENT_LISTENERS].get("${eventName}").add([__f__, true]);\n`;
						script += `el.addEventListener("${eventName}", __f__);\n`
						script += `}\n`
					}
					catch (e) {
						// if skip datex functions enabled, this function is just ignored and later activated via DATEX
						// (throws if "no-datex" is not set)
						if (!opts?.allowIgnoreDatexFunctions) throw e;
					}
				}

			}
		}

		// inject element update triggers
		const datexUpdateType:"onsubmit"|"onchange" = (el as any)[DOMUtils.DATEX_UPDATE_TYPE] ?? opts?.datex_update_type?.at(-1) ?? "onchange";
		const form = opts?.forms?.at(-1);

		if (datexUpdateType == "onsubmit" && !form) {
			throw new Error(`Invalid datex-update="onsubmit", no form found`)
		}

		for (const [attr, ptr] of (<DOMUtils.elWithEventListeners>el)[DOMUtils.PSEUDO_ATTR_BINDINGS] ?? []) {

			hasScriptContent = true;
			const propName = attr == "checked" ? "checked" : "value";
			const keepAlive = datexUpdateType == "onsubmit"
			const fn = getValueUpdater(ptr, false, keepAlive);
			script += `{\n`
			script += `const __f1__ = ${fn.toString()};`; 
			script += `const __original__ = el.${propName};`;
			script += `const __f__ = async function(diff, e) {
				const val = el.${propName};
				if (diff && val == __original__) return;
				try {
					const res = await __f1__(val);
					el.setCustomValidity("")
					el.reportValidity()
					return res;
				} 
				catch (e) {
					const message = e?.message ?? e?.toString()
					el.setCustomValidity(message)
					el.reportValidity()
					if (e) e.preventDefault() // TODO
				}
			};\n`;

			// onsubmit
			if (datexUpdateType == "onsubmit") {
				script += `const form = querySelector('[uix-ptr="${form}"]');\n`
				script += `form.addEventListener("submit", (e) => __f__(true, e));\n`
			}
			// onchange
			else {
				const eventName = attr == "checked" ? "change" : "input";
				script += `el.addEventListener("${eventName}", __f__);\n`
			}
			script += `}\n`

			// console.log("binding", attr, Datex.Runtime.valueToDatexStringExperimental(ptr), fn.toString())
		}

		if (hasScriptContent) opts._injectedJsData.init.push(script);
	}

	if (selfClosingTags.has(tag)) return `<${tag} ${attrs.join(" ")}/>`;
	else return `<${tag} ${attrs.join(" ")}>${inner}</${tag}>`
	// const outer = el.cloneNode().outerHTML;
	// const start = outer.replace(/<\/[A-Za-z0-9-_ ]+>$/, '');
	// const end = outer.match(/<\/[A-Za-z0-9-_ ]+>$/)?.[0] ?? ""; // might not have an end tag
	// return start + inner + end;
}

function getFunctionWithContext(fn: (...args: unknown[]) => unknown, isStandaloneContext?: boolean) {
	const isStandaloneFunction = (fn as any)[STANDALONE] || fn instanceof JSTransferableFunction;
	const forceBindToOriginContext = !isStandaloneContext&&!isStandaloneFunction;
	return (forceBindToOriginContext ? bindToOrigin(fn) : fn);
}

function getFunctionSource(fn: (...args: unknown[]) => unknown, isStandaloneContext: boolean) {
	const listenerFn = getFunctionWithContext(fn, isStandaloneContext)

	let companionSource = ''

	const dependencies = listenerFn instanceof JSTransferableFunction ? listenerFn.deps : {};

	const keys = listenerFn instanceof JSTransferableFunction ? Object.keys(listenerFn.deps) : null;
	if (listenerFn instanceof JSTransferableFunction && keys!.length && !(keys!.length == 1 && keys![0] === "this") && !listenerFn.flags?.includes("no-datex")) {
		throw new Error('use() declaration must have a "no-datex" flag because the context has no DATEX runtime: use("no-datex")')
	}

	let hasContext = false;
	const ctxId = Datex.Pointer.getByValue(dependencies['this'])?.id;
	if (ctxId && dependencies['this'] instanceof domContext.Element) {
		hasContext = true;
		companionSource += `const ctx = querySelector('[uix-ptr="${ctxId}"]');\n`
	}

	// add deps if transferable js fn

	for (const [varName, value] of Object.entries(dependencies)) {
		// this already injected
		if (varName == "this") continue;
		// handle functions
		else if (typeof value == "function") {
			const fnSource = getFunctionSource(value as (...args: unknown[]) => unknown, isStandaloneContext);
			companionSource += fnSource.companionSource;
			companionSource += `const ${varName} = ${fnSource.source};\n`
		}		
		// handle dom elements
		else if (value instanceof domContext.Element) {
			const ptrId = Datex.Pointer.getByValue(value)?.id;
			if (ptrId) {
				companionSource += `const ${varName} = querySelector('[uix-ptr="${ptrId}"]');\n`
			}
			else {
				throw new Error("Cannot bind variable '" + varName + "' to a frontend context with use() - DOM element has no pointer.");
			}
		}
		// json values
		else {
			try {
				// with convertJSONInput
				if (value && typeof value == "object") {
					companionSource += `const {createStaticObject} = await import("uix/standalone/create-static-object.ts");\n`
					companionSource += `const ${varName} = createStaticObject(${serializeJSValue(value)});\n`
				}
				else {
					companionSource += `const ${varName} = ${serializeJSValue(value)};\n`
				}
			
			}
			catch (e){
				console.log(e)
				throw new Error("Cannot bind variable '" + varName + "' to a frontend context with use() - this value is not supported.");
			}
		}

	}
	
	// else if (!context) {
	// 	throw new Error("Cannot infer 'this' in runInDisplayContext(). Please provide it as an argument.")
	// }

	const source = hasContext ? getFunctionWrapper(listenerFn, "ctx") : listenerFn.toString()

	return {source, companionSource}
}

function getFunctionWrapper(fn: Function, contextName = "ctx") {
	const fnSource = fn.toString();

	// native function not supported
	if (fnSource == 'function () { [native code] }') {
		throw new Error("Invalid native function binding for standalone mode (If you are using bind(), it is not supported.)");
	}
	// normal function with own 'this' context
	if (isNormalFunction(fnSource)) return fnSource;
	// object methods check if 'this' context is component context;
	else if (!isArrowFunction(fnSource) && isObjectMethod(fnSource)) {
		console.log(fn);
		logger.warn("Unstable function binding (not supported for backend rendering): cannot determine 'this' context for '"+fn.name+"()'");	
	}
	// context wrapper for arrow function or object method
	else return `(function (...args){return (${fnSource})(...args)}).bind(${contextName})`
}


const isArrowFunction = (fnSrc:string) => {
	return !!fnSrc.match(/^(async\s+)?\([^)]*\)\s*=>/)
}

const isObjectMethod = (fnSrc:string) => {
	return !!fnSrc.match(/^(async\s+)?[^\s(]+ *(\(|\*)/)
}
 
const isNormalFunction = (fnSrc:string) => {
	return !!fnSrc.match(/^(async\s+)?function(\(| |\*)/)
}

function isLiveNode(node: Node) {
	// hybrid components are always live (TODO: not for backend-only components)
	if (node instanceof Component) return true;
	if (node[DOMUtils.PSEUDO_ATTR_BINDINGS]?.size) return true;
	if (node[DOMUtils.EVENT_LISTENERS]?.size) return true;
}

export function getOuterHTML(el:Element|DocumentFragment, opts?:{includeShadowRoots?:boolean, injectStandaloneJS?:boolean, injectStandaloneComponents?: boolean, allowIgnoreDatexFunctions?: boolean, lang?:string}):[header_script:string, html_content:string] {

	if ((el as any)[CACHED_CONTENT]) return (el as any)[CACHED_CONTENT];

	const scriptData:injectScriptData = {declare:{}, init:[]};
	if (opts?.injectStandaloneJS) (opts as any)._injectedJsData = scriptData;

	const collectedStylesheets:string[] = []

	// TODO: only workaround
	// if (opts?.lang) UIX.language = opts.lang;

	let html = _getOuterHTML(el, opts, collectedStylesheets);

	// add collected stylesheet urls from html components
	let injectedStyles = ""
	let injectedStyleSheets = new Set<string>()
	for (const urlOrStylesheet of collectedStylesheets) {
		if (urlOrStylesheet instanceof CSSStyleSheet) {
			const css = urlOrStylesheet._cached_css ?? [...urlOrStylesheet.cssRules].map(c=>c.cssText).join("\n");
			if (!injectedStyleSheets.has(css)) {
				injectedStyles += `<style>${css}</style>`
				injectedStyleSheets.add(css)
			}
		}
		else {
			const link = `<link rel="stylesheet" href="${convertToWebPath(urlOrStylesheet)}">`;
			if (!injectedStyles.includes(link)) injectedStyles += `${link}\n`;
		}
	}
	html = injectedStyles + html;

	let script = `<script type="module">\n`

	script += `import {querySelector, querySelectorAll} from "uix/uix-dom/dom/shadow_dom_selector.ts";\n;`;

	if (opts?.injectStandaloneJS) {
		// global imports and definitions
		script += `import {bindPrototype} from "uix/standalone/get_prototype_properties.ts";\n`
		script += `import {bindContentProperties} from "uix/standalone/bound_content_properties.ts";\n`
		script += `globalThis.querySelector = querySelector;\nglobalThis.querySelectorAll = querySelectorAll;\n`
		script += `globalThis.bindPrototype = bindPrototype;\n`
		script += `globalThis.bindContentProperties = bindContentProperties;\n`
		script += `const EVENT_LISTENERS = Symbol.for("DOMUtils.EVENT_LISTENERS");\n`

		// inject declarations
		if (opts?.injectStandaloneComponents) {
			script += `globalThis.UIX_Standalone = {};\n`
			for (const [name, val] of Object.entries(scriptData.declare)) {
				script += `globalThis.UIX_Standalone.${name} = ${val};\n`
			}
		}
		
	}
	
	// initialization scripts
	let init_script = "";
	for (const val of scriptData.init) {
		init_script += `{\n${val}\n}\n`
	}

	// scripts when DOM loaded:
	script += `
	(globalThis.addEventListenerOnce ?? globalThis.addEventListener)("DOMContentLoaded", async ()=>{
		// polyfill for browsers that don't support declarative shadow DOM
		if (!HTMLTemplateElement.prototype.hasOwnProperty('shadowRootMode')) {
			(function attachShadowRoots(root) {
				querySelectorAll("template[shadowrootmode]").forEach((template) => {
					const mode = template.getAttribute("shadowrootmode");
					if (template.parentNode) {
						const shadowRoot = template.parentNode.attachShadow({ mode });
						shadowRoot.appendChild(template.content);
						template.remove();
						attachShadowRoots(shadowRoot);
					}
				});
			})(document);
		}

		${init_script};
	})\n`

	script += `</script>`

	return [script, html];
}


// https://gist.github.com/developit/54f3e3d1ce9ed0e5a171044edcd0784f
// @ts-ignore
if (!domContext.Element.prototype.getInnerHTML) {
	// @ts-ignore
	domContext.Element.prototype.getInnerHTML = function(opts?:{includeShadowRoots?:boolean, lang?:string}) {
	  return getInnerHTML(this, opts);
	}
}

// @ts-ignore
if (!domContext.Element.prototype.getOuterHTML) {
	// @ts-ignore
	domContext.Element.prototype.getOuterHTML = function(opts?:{includeShadowRoots?:boolean, injectStandaloneJS?:boolean, injectStandaloneComponents?: boolean, lang?:string}) {
		return getOuterHTML(this, opts);
	}
}


export type HTMLPageOptions = {
	provider:HTMLProvider, 
	prerendered_content?:string|[header_scripts:string, html_content:string], 
	render_method?:RenderMethod, 
	color_scheme: "dark"|"light",
	css?: string,
	js_files:(URL|string|undefined)[], 
	static_js_files:(URL|string|undefined)[],
	global_css_files:(URL|string|undefined|Record<string,string>)[], 
	body_css_files:(URL|string|undefined)[], 
	frontend_entrypoint?:URL|string, 
	backend_entrypoint?:URL|string, 
	open_graph_meta_tags?:OpenGraphInformation, 
	lang?: string, 
	livePointers?: string[],
	includeImportMap?: boolean
}


export async function generateHTMLPage({
	provider, 
	prerendered_content, 
	render_method, 
	color_scheme,
	css,
	js_files, 
	static_js_files,
	global_css_files, 
	body_css_files, 
	frontend_entrypoint, 
	backend_entrypoint, 
	open_graph_meta_tags, 
	lang, 
	livePointers,
	includeImportMap
}: HTMLPageOptions) {

	lang ??= "en"
	render_method ??= RenderMethod.HYBRID;
	js_files ??= []
	static_js_files ??= []
	global_css_files ??= []
	body_css_files ??= []
	includeImportMap ??= true;

	let files = '';
	let metaScripts = ''

	// use frontendRuntime if rendering DYNAMIC or HYDRATION, and entrypoints are loaded, otherwise just static content and standalone js
	const useFrontendRuntime = (render_method == RenderMethod.DYNAMIC || render_method == RenderMethod.HYBRID || render_method == RenderMethod.PREVIEW) && !!(frontend_entrypoint || backend_entrypoint || provider.live);

	// js files
	if (useFrontendRuntime) {
		files += '<script type="module">'

		// js imports
		files += indent(4) `
			${prerendered_content?`${"import {disableInitScreen}"} from "${provider.resolveImport("datex-core-legacy/runtime/display.ts").toString()}";\ndisableInitScreen();\n` : ''}
			const {f} = (await import("${provider.resolveImport("datex-core-legacy").toString()}"));
			const {Routing} = (await import("${provider.resolveImport("uix/routing/frontend-routing.ts").toString()}"));` 
			// await new Promise(resolve=>setTimeout(resolve,5000))

		// files += `\nDatex.MessageLogger.enable();`

		if (app.options?.experimentalFeatures.includes("protect-pointers")) files +=  indent(4) `\nDatex.Runtime.OPTIONS.PROTECT_POINTERS = true;`

		// set app info

		for (const file of js_files) {
			if (file) files += indent(4) `\nawait import("${provider.resolveImport(file).toString()}");`
		}

		// hydrate
		if (prerendered_content && render_method == RenderMethod.HYBRID) {
			files += indent(4) `\nimport {hydrate} from "uix/hydration/hydrate.ts"; hydrate();`
		}


		// load frontend entrypoint first
		if (frontend_entrypoint) {
			files += indent(4) `\n\nconst _frontend_entrypoint = await datex.get("${provider.resolveImport(frontend_entrypoint).toString()}");`
		}

		// hydration with backend content after ssr
		if (backend_entrypoint) {
			// load default export of ts module or dx export
			files += indent(4) `\n\nconst _backend_entrypoint = await datex.get("${provider.resolveImport(backend_entrypoint).toString()}");let backend_entrypoint;\nif (_backend_entrypoint.default) backend_entrypoint = _backend_entrypoint.default\nelse if (_backend_entrypoint && Object.getPrototypeOf(_backend_entrypoint) != null) backend_entrypoint = _backend_entrypoint;`
		}
		// alternative: frontend rendering
		if (frontend_entrypoint) {
			// load default export of ts module or dx export
			files += indent(4) `\nlet frontend_entrypoint; if (_frontend_entrypoint.default) frontend_entrypoint = _frontend_entrypoint.default\nelse if (_frontend_entrypoint && Object.getPrototypeOf(_frontend_entrypoint) != null) frontend_entrypoint = _frontend_entrypoint;`
		}

		const isHydrating = prerendered_content && (render_method == RenderMethod.HYBRID || render_method == RenderMethod.BACKEND);
		const isHydratingVal = isHydrating ? 'true' : 'false'

		const mergeFrontendVal = render_method == RenderMethod.PREVIEW ? "'override'" : "'insert'"

		if (backend_entrypoint && frontend_entrypoint)
			files += `\n\nawait Routing.setEntrypoints(frontend_entrypoint, backend_entrypoint, ${isHydratingVal}, ${mergeFrontendVal})`
		else if (backend_entrypoint)
			files += `\n\nawait Routing.setEntrypoints(undefined, backend_entrypoint, ${isHydratingVal}, ${mergeFrontendVal})`
		else if (frontend_entrypoint)
			files += `\n\nawait Routing.setEntrypoints(frontend_entrypoint, undefined, ${isHydratingVal}, ${mergeFrontendVal})`

		files += '\n</script>\n'
	}

	// inject UIX app metadata and static js files
	if (render_method != RenderMethod.STATIC) {
		metaScripts += indent(4) `
			<script type="uix-app">
				${JSON.stringify({
					name: provider.app_options.name, 
					version: provider.app_options.version, 
					stage: stage, 
					backend: Datex.Runtime.endpoint.toString(),
					backendLibVersions: {
						uix: UIX.version,
						datex: Datex.Runtime.VERSION,
					},
					host: Datex.Unyt.endpoint_info.app?.host ? Datex.Unyt.endpoint_info.app.host.toString() : null,
					dynamicData: {
						domains: app.domains
					},
					usid: app.uniqueStartId,
					hod: app.metadata.hod
				}, null, "    ")}
			</script>\n`

		// add pointer sse observers
		if (livePointers) {
			files += indent `<script type="module">
				const {BackgroundRunner} = (await import("${provider.resolveImport("uix/background-runner/background-runner.ts").toString()}"));
				const backgroundRunner = BackgroundRunner.get();
				backgroundRunner.observePointers(${JSON.stringify(livePointers)});
			</script>`	
		}

		for (const file of static_js_files) {
			if (file) files += indent(4) `<script type="module" src="${provider.resolveImport(file).toString()}"></script>`
		}
	}

	// TODO: add condition if (add_importmap), when polyfill for declarative shadow root is no longer required
	if (includeImportMap) metaScripts += `<script type="importmap">\n${JSON.stringify(provider.getRelativeImportMap(), null, 4)}\n</script>`;
	
	let global_style = '';
	// stylesheets
	for (const stylesheet of global_css_files) {
		if (!stylesheet) continue;
		if (!(typeof stylesheet == "string" || stylesheet instanceof URL)) {
			global_style += `<link rel="stylesheet" ${Object.entries(stylesheet).map(([k,v]) => `${k}="${k == "href" ? provider.resolveImport(v, true) : v}"`).join(" ")}>\n`;
		}
		else global_style += `<link rel="stylesheet" href="${provider.resolveImport(stylesheet, true)}">\n`;
	}

	// custom inline css
	if (css) {
		global_style += `<style>${css}</style>`
	}
	
	// available global uix themes
	global_style += `<style class="uix-themes">`
	global_style += UIX.Theme.getThemesCSS().replaceAll("\n","");
	global_style += "</style>"

	let body_style = ''
	// stylesheets
	for (const stylesheet of body_css_files) {
		if (!stylesheet) continue;
		body_style += `<link rel="stylesheet" href="${provider.resolveImport(stylesheet, true)}">\n`;
	}

	let favicon = "";
	// TODO: remove icon_path, use icon instead
	if (provider.app_options.icon || provider.app_options.icon) favicon = `<link rel="icon" href="${provider.resolveImport(provider.app_options.icon??provider.app_options.icon)}">`

	let custom_meta = ""
 
	if (provider.app_options.meta) {
		for (const [key, value] of Object.entries(provider.app_options.meta)) {
			custom_meta += `<meta name="${domUtils.escapeHtml(key)}" content="${domUtils.escapeHtml(value)}"/>\n`
		}
	}

	// TODO: fix open_graph_meta_tags?.getMetaTags()
	return indent `<!DOCTYPE html>
		<html lang="${lang}" style="color-scheme:${color_scheme}">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
				<meta name="view-transition" content="same-origin"/>
				<meta name="color-scheme" content="${color_scheme}"/>
				<meta name="theme-color"/>	
				${await open_graph_meta_tags?.getMetaTags() ?? (provider.app_options.name ? `<title>${provider.app_options.name}</title>` : '')}
				${custom_meta}
				${favicon}
				${provider.app_options.installable||provider.app_options.manifest ? `<link rel="manifest" href="/@uix/manifest.json">` : ''}
				${provider.app_options.installable||provider.app_options.manifest ? `<script async src="https://cdn.jsdelivr.net/npm/pwacompat" crossorigin="anonymous"></script>` : ''}
				${metaScripts}
				${global_style}
				${files}
				${prerendered_content instanceof Array ? prerendered_content[0] : ''}
				<script>
					(globalThis.addEventListenerOnce ?? globalThis.addEventListener)("DOMContentLoaded", () => {
						document.body.style.visibility = "visible"
					});
				</script>
				<noscript>
					<style>
						body {
							visibility: visible!important;
						}
					</style>
					<link rel="stylesheet" href="${provider.resolveImport("uix/style/noscript.css", true)}">
				</noscript>
			</head>
			<body style="visibility:hidden;" data-color-scheme="${color_scheme}">
			` +
(prerendered_content instanceof Array ? prerendered_content[1] : (prerendered_content??'')) + `
			</body>
		</html>
	`

}