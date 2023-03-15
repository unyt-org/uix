import { Path } from "unyt_node/path.ts";

await import("./deno_dom.ts");


// function getInnerHTML(el:Element|ShadowRoot, opts?:{includeShadowRoots?:boolean, closedRoots?:any[]}) {
// 	const html = el.innerHTML;
// 	if (!opts || !opts.includeShadowRoots) return html;
// 	const m = new (self.WeakMap || Map)();
// 	for (const c of (opts.closedRoots || [])) m.set(c.host, c);
// 	const p = [];
// 	function walk(node:Node) {
// 	  var c, shadow = node.shadowRoot || m.get(node);
// 	  if (shadow) p.push(getInnerHTML(node), `<template shadowrootmode="${shadow.mode}">${getInnerHTML(shadow, opts)}</template>`);
// 	  var c = node.firstElementChild;
// 	  while (c) { walk(c); c = c.nextElementSibling; }
// 	}
// 	walk(el);
// 	let out = '', c = 0, i = 0, o;
// 	for (; c<p.length; c+=2) {
// 	  o = html.indexOf(p[c], i);
// 	  if (o < 0) continue;
// 	  out += html.substring(i, o) + p[c+1];
// 	  i = o;
// 	}
// 	return out + html.substring(i);
// }

export async function getInnerHTML(el:Element|ShadowRoot, opts?:{includeShadowRoots?:boolean, rootDir?:URL}) {
	if (!opts?.includeShadowRoots) return el.innerHTML;

	let html = "";
	if (el instanceof globalThis.Element && el.shadowRoot) {
		html += `<template shadowrootmode="${el.shadowRoot.mode}">`
		html += await getInnerHTML(el.shadowRoot, opts);

		if (el.getRenderedStyle) html += el.getRenderedStyle(opts.rootDir);

		html += '</template>'
	}

	for (const child of el.childNodes) {
		html += await getOuterHTML(child, opts);
	}

	return html || el.innerText || ""; // TODO: why sometimes no childnodes in jsdom (e.g UIX.Elements.Button)
}

export async function getOuterHTML(el:Element, opts?:{includeShadowRoots?:boolean, rootDir?:URL}) {
	if (el instanceof globalThis.Text) return el.textContent ?? ""; // text node

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

	return `<${tag} ${attrs.join(" ")}>${inner}</${tag}>`
	// const outer = el.cloneNode().outerHTML;
	// const start = outer.replace(/<\/[A-Za-z0-9-_ ]+>$/, '');
	// const end = outer.match(/<\/[A-Za-z0-9-_ ]+>$/)?.[0] ?? ""; // might not have an end tag
	// return start + inner + end;
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
	globalThis.Element.prototype.getInnerHTML = function(opts?:{includeShadowRoots?:boolean, rootDir?:URL}) {
	  return getInnerHTML(this, opts);
	}
}


if (!globalThis.Element.prototype.getOuterHTML) {
	globalThis.Element.prototype.getOuterHTML = function(opts?:{includeShadowRoots?:boolean, rootDir?:URL}) {
		return getOuterHTML(this, opts);
	}
}
