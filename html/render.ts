import { Datex } from "unyt_core";
import { App } from "../app/app.ts";
import { OpenGraphInformation } from "../base/open_graph.ts";
import { UIX } from "../uix.ts";
import { indent } from "../utils/indent.ts";
import type { HTMLProvider } from "./html_provider.ts";
import { HTMLUtils } from "./utils.ts";
import { COMPONENT_CONTEXT, STANDALONE } from "../snippets/bound_content_properties.ts";
import { BACKEND_EXPORT } from "../app/interface_generator.ts";

await import("./deno_dom.ts");

type injectScriptData = {declare:Record<string,string>, init:string[]};

type _renderOptions = {includeShadowRoots?:boolean,  _injectedJsData?:injectScriptData, lang?:string}

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
	if (opts?._injectedJsData && el.standaloneEnabled?.()) {
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

export async function getInnerHTML(el:Element|ShadowRoot, opts?:_renderOptions, collectedStylsheets?:string[]) {
	if (!opts?.includeShadowRoots) return el.innerHTML;

	let html = "";

	// load js (into opts._injectedJsData) if UIX component with standalone methods
	loadStandaloneJS(el, opts);

	// add shadow root
	if (el instanceof globalThis.Element && el.shadowRoot) {
		html += `<template shadowrootmode="${el.shadowRoot.mode}">`
		// collect stylsheets that children require
		const collectedStylesheets:string[] = []
		html += await getInnerHTML(el.shadowRoot, opts, collectedStylesheets);
		for (const link of collectedStylesheets) html += `<link rel="stylesheet" href="${App.filePathToWebPath(link)}">\n`;
		// @ts-ignore
		if (el.getRenderedStyle) html += el.getRenderedStyle();
		html += '</template>'
	}

	else {
		// @ts-ignore
		if (el.style_sheets_urls && collectedStylsheets) collectedStylsheets.push(...el.style_sheets_urls)
	}

	for (const child of (el.childNodes as unknown as Node[])) {
		html += await _getOuterHTML(child, opts, collectedStylsheets);
	}

	return html || HTMLUtils.escapeHtml((el as HTMLElement).innerText ?? ""); // TODO: why sometimes no childnodes in jsdom (e.g UIX.Elements.Button)
}

async function _getOuterHTML(el:Node, opts?:_renderOptions, collectedStylsheets?:string[]):Promise<string> {
	
	if (el instanceof globalThis.Text) return HTMLUtils.escapeHtml(el.textContent ?? ""); // text node

	if (el instanceof DocumentFragment) {
		const content = [];
		for (const child of (el.childNodes as unknown as Node[])) {
			content.push(await _getOuterHTML(child, opts, collectedStylsheets));
		}
		return content.join("\n");
	}

	if (el instanceof globalThis.Comment) {
		return `<!--${el.textContent}-->`
	}

	// invalid node/element
	if (!(el instanceof Element)) {
		console.log("cannot render node",el);
		throw "invalid HTML node"
	}

	const inner = await getInnerHTML(el, opts, collectedStylsheets);
	const tag = el.tagName.toLowerCase();
	const attrs = [];

	const dataPtr = el.attributes.getNamedItem("data-ptr")?.value;

	for (let i = 0; i < el.attributes.length; i++) {
		const attrib = el.attributes[i];
		let val = attrib.value;
		// relative web path (@...)
		if (val.startsWith("file://")) val = App.filePathToWebPath(val);
		// blob -> data url
		else if (val.startsWith("blob:")) {
			val = await blobToBase64(val) as string;
		}
		attrs.push(`${attrib.name}="${val}"`) // TODO escape
	}
	attrs.push("data-static");

	const standaloneContext = (<any>el)[STANDALONE];

	// inject event listeners
	if (dataPtr && opts?._injectedJsData && (<HTMLUtils.elWithEventListeners>el)[HTMLUtils.EVENT_LISTENERS]) {
		const context = <HTMLElement|undefined>(<any>el)[COMPONENT_CONTEXT];
		const contextPtr = context?.attributes.getNamedItem("data-ptr")?.value;
		let script = `  const el = querySelector('[data-ptr="${dataPtr}"]');\n  const ctx = querySelector('[data-ptr="${contextPtr}"]');\n`
		for (const [event, listeners] of (<HTMLUtils.elWithEventListeners>el)[HTMLUtils.EVENT_LISTENERS]) {
			for (const listener of listeners) {
				// @ts-ignore
				const standaloneFunction = listener[STANDALONE];
				// @ts-ignore
				// const backendExportFunction = listener[BACKEND_EXPORT];
				const forceBindToOriginContext = !standaloneContext&&!standaloneFunction;
				const listenerSource = (forceBindToOriginContext ? UIX.bindToOrigin(listener) : listener).toString();

				// native function not supported
				if (listenerSource == 'function () { [native code] }') {
					throw new Error("Invalid event handler for standalone mode: native function in 'on"+event+"' handler (If you are using bind(), it is not supported.)");
				}
				// normal function with own 'this' context
				if (isNormalFunction(listenerSource)) script += `  el.addEventListener("${event}", ${listenerSource});`
				// object methods check if 'this' context is component context;
				else if (isObjectMethod(listenerSource)) {
					throw new Error("Invalid event handler for standalone mode: cannot determine context for '"+listener.name+"()' on 'on"+event+"' handler");	
					// const name = listener.name;
					// // is property of context
					// if ((<any>context)?.[name] === listener) {
					// 	script += `  el.addEventListener("${event}", (function (...args){return this['${name}'](...args)}).bind(ctx));`
					// }
					// // other 'this' context, not supported
					// else throw new Error("Invalid event handler for standalone mode: not a standalone context ("+listener.name+")");	
				}
				// context wrapper for arrow function or object method
				else script += `  el.addEventListener("${event}", (function (...args){return (${listenerSource})(...args)}).bind(ctx));`
			}
		}
		opts._injectedJsData.init.push(script);
	}

	if (selfClosingTags.has(tag)) return `<${tag} ${attrs.join(" ")}/>`;
	else return `<${tag} ${attrs.join(" ")}>${inner}</${tag}>`
	// const outer = el.cloneNode().outerHTML;
	// const start = outer.replace(/<\/[A-Za-z0-9-_ ]+>$/, '');
	// const end = outer.match(/<\/[A-Za-z0-9-_ ]+>$/)?.[0] ?? ""; // might not have an end tag
	// return start + inner + end;
}

// const isArrowFn = (fn:Function) => 
//   (typeof fn === 'function') &&
//   !/^(?:(?:\/\*[^(?:\*\/)]*\*\/\s*)|(?:\/\/[^\r\n]*))*\s*(?:(?:(?:async\s(?:(?:\/\*[^(?:\*\/)]*\*\/\s*)|(?:\/\/[^\r\n]*))*\s*)?function|class)(?:\s|(?:(?:\/\*[^(?:\*\/)]*\*\/\s*)|(?:\/\/[^\r\n]*))*)|(?:[_$\w][\w0-9_$]*\s*(?:\/\*[^(?:\*\/)]*\*\/\s*)*\s*\()|(?:\[\s*(?:\/\*[^(?:\*\/)]*\*\/\s*)*\s*(?:(?:['][^']+['])|(?:["][^"]+["]))\s*(?:\/\*[^(?:\*\/)]*\*\/\s*)*\s*\]\())/.test(fn.toString());

const isObjectMethod = (fnSrc:string) => {
	return !!fnSrc.match(/^(async\s+)?[^\s(]+ *(\(|\*)/)
}
 
const isNormalFunction = (fnSrc:string) => {
	return !!fnSrc.match(/^(async\s+)?function(\(| |\*)/)
}
 



export async function getOuterHTML(el:Element|DocumentFragment, opts?:{includeShadowRoots?:boolean, injectStandaloneJS?:boolean, lang?:string}):Promise<[header_script:string, html_content:string]> {
	if ((el as any)[CACHED_CONTENT]) return (el as any)[CACHED_CONTENT];

	const scriptData:injectScriptData = {declare:{}, init:[]};
	if (opts?.injectStandaloneJS) (opts as any)._injectedJsData = scriptData;

	const html = await _getOuterHTML(el, opts);

	let script = `<script type="module">\n`
	// global imports and definitions
	script += `import {querySelector, querySelectorAll} from "uix/snippets/shadow_dom_selector.ts";\n`
	script += `import {bindPrototype} from "uix/snippets/get_prototype_properties.ts";\n`
	script += `import {bindContentProperties} from "uix/snippets/bound_content_properties.ts";\n`
	script += `globalThis.querySelector = querySelector;\nglobalThis.querySelectorAll = querySelectorAll;\n`
	script += `globalThis.bindPrototype = bindPrototype;\n`
	script += `globalThis.bindContentProperties = bindContentProperties;\n`

	// inject declarations
	script += `globalThis.UIX_Standalone = {};\n`
	for (const [name, val] of Object.entries(scriptData.declare)) {
		script += `globalThis.UIX_Standalone.${name} = ${val};\n`
	}

	// initialization scripts
	let init_script = "";
	for (const val of scriptData.init) {
		init_script += `{\n${val}\n}\n`
	}

	// scripts when DOM loaded:
	script += `
	addEventListener("DOMContentLoaded", async ()=>{
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

async function blobToBase64(blobUri:string|URL) {
	const blob = await fetch(blobUri).then(r => r.blob());
	return new Promise<string|ArrayBuffer|null>((resolve, _) => {
	  const reader = new FileReader();
	  reader.onloadend = () => resolve(reader.result);
	  reader.readAsDataURL(blob);
	});
  }

// https://gist.github.com/developit/54f3e3d1ce9ed0e5a171044edcd0784f
// @ts-ignore
if (!globalThis.Element.prototype.getInnerHTML) {
	// @ts-ignore
	globalThis.Element.prototype.getInnerHTML = function(opts?:{includeShadowRoots?:boolean, lang?:string}) {
	  return getInnerHTML(this, opts);
	}
}

// @ts-ignore
if (!globalThis.Element.prototype.getOuterHTML) {
	// @ts-ignore
	globalThis.Element.prototype.getOuterHTML = function(opts?:{includeShadowRoots?:boolean, injectStandaloneJS?:boolean, lang?:string}) {
		return getOuterHTML(this, opts);
	}
}




export async function generateHTMLPage(provider:HTMLProvider, prerendered_content?:string|[header_scripts:string, html_content:string], render_method:UIX.RenderMethod = UIX.RenderMethod.HYDRATION, js_files:(URL|string|undefined)[] = [], global_css_files:(URL|string|undefined)[] = [], body_css_files:(URL|string|undefined)[] = [], frontend_entrypoint?:URL|string, backend_entrypoint?:URL|string, open_graph_meta_tags?:OpenGraphInformation, compat_import_map = false, lang = "en"){
	let files = '';
	let importmap = ''

	// use js if rendering DYNAMIC or HYDRATION, and entrypoints are loaded, otherwise just static content
	const use_js = (render_method == UIX.RenderMethod.DYNAMIC || render_method == UIX.RenderMethod.HYDRATION) && !!(frontend_entrypoint || backend_entrypoint || provider.live);
	const add_importmap = render_method != UIX.RenderMethod.STATIC_NO_JS;

	//js files
	if (use_js) {
		files += '<script type="module">'

		// js imports
		files += indent(4) `
			${prerendered_content?`${"import {disableInitScreen}"} from "${provider.resolveImport("unyt_core/runtime/display.ts", compat_import_map).toString()}";\ndisableInitScreen();\n` : ''}
			const f = (await import("${provider.resolveImport("unyt_core", compat_import_map).toString()}")).f;
			const UIX = (await import("${provider.resolveImport("uix", compat_import_map).toString()}")).UIX;` 
			// await new Promise(resolve=>setTimeout(resolve,5000))

		// files += `\nDatex.MessageLogger.enable();`


		// set app info
		files += indent(4) `\n\nUIX.State._setMetadata({name:"${provider.app_options.name??''}", version:"${provider.app_options.version??''}", stage:"${provider.app_options.stage??''}", backend:f("${Datex.Runtime.endpoint.toString()}")});`

		for (const file of js_files) {
			if (file) files += indent(4) `\nawait import("${provider.resolveImport(file, compat_import_map).toString()}");`
		}

		// load frontend entrypoint first
		if (frontend_entrypoint) {
			files += indent(4) `\n\nconst _frontend_entrypoint = await datex.get("${provider.resolveImport(frontend_entrypoint, compat_import_map).toString()}");`
		}

		// hydration with backend content after ssr
		if (backend_entrypoint) {
			// load default export of ts module or dx export
			files += indent(4) `\n\nconst _backend_entrypoint = await datex.get("${provider.resolveImport(backend_entrypoint, compat_import_map).toString()}");let backend_entrypoint;\nif (_backend_entrypoint.default) backend_entrypoint = _backend_entrypoint.default\nelse if (_backend_entrypoint && Object.getPrototypeOf(_backend_entrypoint) != null) backend_entrypoint = _backend_entrypoint;`
		}
		// alternative: frontend rendering
		if (frontend_entrypoint) {
			// load default export of ts module or dx export
			files += indent(4) `\nlet frontend_entrypoint; if (_frontend_entrypoint.default) frontend_entrypoint = _frontend_entrypoint.default\nelse if (_frontend_entrypoint && Object.getPrototypeOf(_frontend_entrypoint) != null) frontend_entrypoint = _frontend_entrypoint;`
		}

		if (backend_entrypoint && frontend_entrypoint)
			files += `\n\nawait UIX.Routing.setEntrypoints(frontend_entrypoint, backend_entrypoint)`
		else if (backend_entrypoint)
			files += `\n\nawait UIX.Routing.setEntrypoints(undefined, backend_entrypoint)`
		else if (frontend_entrypoint)
			files += `\n\nawait UIX.Routing.setEntrypoints(frontend_entrypoint, undefined)`

		files += '\n</script>'
	}

	if (add_importmap) importmap = `<script type="importmap">\n${JSON.stringify(provider.getRelativeImportMap(), null, 4)}\n</script>`;
	
	let global_style = '';
	// stylesheets
	for (const stylesheet of global_css_files) {
		if (!stylesheet) continue;
		global_style += `<link rel="stylesheet" href="${provider.resolveImport(stylesheet, true)}">\n`;
	}

	// global variable stylesheet
	global_style += "<style>"
	global_style += UIX.Theme.getCurrentThemeCSS().replaceAll("\n","");
	global_style += "</style>"
	
	// dark themes
	global_style += `<style class="uix-light-themes">`
	global_style += UIX.Theme.getLightThemesCSS().replaceAll("\n","");
	global_style += "</style>"

	// light themes
	global_style +=  `<style class="uix-dark-themes">`
	global_style += UIX.Theme.getDarkThemesCSS().replaceAll("\n","");
	global_style += "</style>"

	let body_style = ''
	// stylesheets
	for (const stylesheet of body_css_files) {
		if (!stylesheet) continue;
		body_style += `<link rel="stylesheet" href="${provider.resolveImport(stylesheet, true)}">\n`;
	}

	let favicon = "";
	if (provider.app_options.icon_path) favicon = `<link rel="icon" href="${provider.resolveImport(provider.app_options.icon_path, compat_import_map)}">`

	return indent `
		<!DOCTYPE html>
		<html lang="${lang}">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
				<meta name="theme-color"/>	
				${await open_graph_meta_tags?.getMetaTags() ?? (provider.app_options.name ? `<title>${provider.app_options.name}</title>` : '')}
				${favicon}
				${provider.app_options.installable ? `<link rel="manifest" href="manifest.json">` : ''}
				${importmap}
				${global_style}
				${files}
				${prerendered_content instanceof Array ? prerendered_content[0] : ''}
				<script>
					addEventListener("DOMContentLoaded", () => {
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
			<body style="visibility:hidden; color-scheme:${UIX.Theme.mode}" data-color-scheme="${UIX.Theme.mode}">
				<template shadowrootmode=open>
					<slot id=main></slot>
					${body_style}
				</template>
				${prerendered_content instanceof Array ? prerendered_content[1] : (prerendered_content??'')}
			</body>
		</html>
	`

}