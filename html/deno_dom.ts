import { IS_HEADLESS } from "../utils/constants.ts";

// if (!globalThis.CSSStyleSheet) globalThis.CSSStyleSheet = (await import("./deno_css_style_sheet.ts")).CSSStyleSheet;

if (IS_HEADLESS) {

	// const linkedom = await import("https://esm.sh/linkedom@0.14.22");

	// const { document, customElements } = linkedom.parseHTML(`<!DOCTYPE html><html><head></head><body style="color:red"></body></html>`, 'text/html');
	// globalThis.document = document
	// globalThis.customElements = customElements
	// globalThis.HTMLElement = linkedom.HTMLElement

	const JSDOM = (await import("https://jspm.dev/npm:jsdom-deno@19.0.1")).JSDOM;

	const { window } = new JSDOM(`<!DOCTYPE html><html><head></head><body style="color:red"></body></html>`);

	globalThis.document = window.document;
	globalThis.HTMLElement = window.HTMLElement;
	globalThis.Element = window.Element;
	globalThis.customElements = window.customElements;
	globalThis.Text = window.Text
	globalThis.MutationObserver = window.MutationObserver;
	globalThis.IntersectionObserver = window.IntersectionObserver;
	globalThis.Comment = window.Comment;
	globalThis.Document = window.Document;
	globalThis.NodeFilter = window.NodeFilter;
	globalThis.NodeIterator = window.NodeIterator;

	globalThis.Node = window.Node;
	globalThis.NodeList = window.NodeList;
	globalThis.requestAnimationFrame = ()=>0;

	// globalThis.location = new URL(import.meta.url);

	globalThis.CSSStyleDeclaration = window.CSSStyleDeclaration;

	globalThis.CSSStyleSheet = (await import("./deno_css_style_sheet.ts")).CSSStyleSheet;

	// globalThis.CSSStyleSheet = window.CSSStyleSheet;
	// await import("https://unpkg.com/construct-style-sheets-polyfill@3.1.0/dist/adoptedStyleSheets.js");
}