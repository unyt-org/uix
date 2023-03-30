import { Path } from "unyt_node/path.ts";
import { HTMLUtils } from "./utils.ts";

await import("./deno_dom.ts");

type injectScriptData = {declare:Record<string,string>, init:string[]};

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

export async function getInnerHTML(el:Element|ShadowRoot, opts?:{includeShadowRoots?:boolean, rootDir?:URL, _injectedJsData?:injectScriptData}) {
	if (!opts?.includeShadowRoots) return el.innerHTML;

	let html = "";
	if (el instanceof globalThis.Element && el.shadowRoot) {
		html += `<template shadowrootmode="${el.shadowRoot.mode}">`
		html += await getInnerHTML(el.shadowRoot, opts);

		if (el.getRenderedStyle) html += el.getRenderedStyle(opts.rootDir);

		// is UIX component with standalone methods?
		// @ts-ignore
		if (opts?._injectedJsData && el.standaloneEnabled?.() && el.constructor.getStandaloneJS) {
			if (!opts._injectedJsData.declare) opts._injectedJsData.declare = {};
			if (!opts._injectedJsData.init) opts._injectedJsData.init = [];

			const name = `UIX_Standalone_${el.constructor.name}`;
			if (!opts._injectedJsData.declare[name]) {
				// @ts-ignore
				opts._injectedJsData.declare[name] = `globalThis.UIX_Standalone_${el.constructor.name} = ${el.constructor.getStandaloneJS()};`
			}
			html += `<script type="module">\n`
			html += `const {querySelectorAll} = await import("uix/snippets/shadow_dom_selector.ts");\n`
			html += `Object.assign(querySelectorAll("[data-ptr='${el.getAttribute("data-ptr")}']")[0], globalThis.UIX_Standalone_${el.constructor.name});\n`
			// @ts-ignore
			if (el.onInitStandalone) html += `await globalThis.UIX_Standalone_${el.constructor.name}.onInitStandalone.call(querySelectorAll("[data-ptr='${el.getAttribute("data-ptr")}']")[0]);\n`;
			// @ts-ignore
			if (el.getStandaloneJS) html += el.getStandaloneJS();
			html += `</script>`
		}


		html += '</template>'
	}

	for (const child of el.childNodes) {
		html += await _getOuterHTML(child, opts);
	}

	return html || HTMLUtils.escapeHtml(el.innerText ?? ""); // TODO: why sometimes no childnodes in jsdom (e.g UIX.Elements.Button)
}

async function _getOuterHTML(el:Element|DocumentFragment, opts?:{includeShadowRoots?:boolean, rootDir?:URL, _injectedJsData?:injectScriptData}):Promise<string> {
	
	if (el instanceof globalThis.Text) return HTMLUtils.escapeHtml(el.textContent ?? ""); // text node

	if (el instanceof DocumentFragment) {
		const content = [];
		for (const child of el.children) {
			content.push(await _getOuterHTML(child, opts));
		}
		return content.join("\n");
	}

	if (el instanceof globalThis.Comment) {
		return `<!--${el.textContent}-->`
	}

	// invalid node/element
	if (!el.tagName) {
		console.log("cannot render node",el);
		throw "invalid HTML node"
	}

	const inner = await getInnerHTML(el, opts);
	const tag = el.tagName.toLowerCase();
	const attrs = [];


	for (let i = 0; i < el.attributes.length; i++) {
		const attrib = el.attributes[i];
		let val = attrib.value;
		// relative web path (@...)
		if (val.startsWith("file://") && opts?.rootDir) val = new Path(val).getAsRelativeFrom(opts.rootDir).replace(/^\.\//, "/@uix/src/");
		// blob -> data url
		else if (val.startsWith("blob:")) {
			val = await blobToBase64(val);
		}
		attrs.push(`${attrib.name}="${val}"`) // TODO escape
	}
	attrs.push("data-static");

	if (selfClosingTags.has(tag)) return `<${tag} ${attrs.join(" ")}/>`;
	else return `<${tag} ${attrs.join(" ")}>${inner}</${tag}>`
	// const outer = el.cloneNode().outerHTML;
	// const start = outer.replace(/<\/[A-Za-z0-9-_ ]+>$/, '');
	// const end = outer.match(/<\/[A-Za-z0-9-_ ]+>$/)?.[0] ?? ""; // might not have an end tag
	// return start + inner + end;
}


export async function getOuterHTML(el:Element|DocumentFragment, opts?:{includeShadowRoots?:boolean, rootDir?:URL, injectStandaloneJS?:boolean}):Promise<string> {
	const scriptData:injectScriptData = {declare:{}, init:[]};
	if (opts?.injectStandaloneJS) opts._injectedJsData = scriptData;

	const html = await _getOuterHTML(el, opts);

	let script = `<script type="module">`
	// global utils
	for (const val of Object.values(scriptData.declare)) {
		script += val
	}
	for (const val of scriptData.init) {
		script += val
	}
	script += `</script>`

	return script + html;
}

async function blobToBase64(blobUri:string|URL) {
	const blob = await fetch(blobUri).then(r => r.blob());
	return new Promise<string>((resolve, _) => {
	  const reader = new FileReader();
	  reader.onloadend = () => resolve(reader.result);
	  reader.readAsDataURL(blob);
	});
  }

// https://gist.github.com/developit/54f3e3d1ce9ed0e5a171044edcd0784f
if (!globalThis.Element.prototype.getInnerHTML) {
	globalThis.Element.prototype.getInnerHTML = function(opts?:{includeShadowRoots?:boolean, rootDir?:URLSearchParams}) {
	  return getInnerHTML(this, opts);
	}
}


if (!globalThis.Element.prototype.getOuterHTML) {
	globalThis.Element.prototype.getOuterHTML = function(opts?:{includeShadowRoots?:boolean, rootDir?:URL, injectStandaloneJS?:boolean}) {
		return getOuterHTML(this, opts);
	}
}
