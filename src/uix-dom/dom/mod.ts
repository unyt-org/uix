// deno_dom
import * as denoDom from "./deno-dom/deno-dom-wasm.ts";
import { CustomElementRegistry } from "./deno-dom/src/dom/custom-element-registry.ts";

import { HTMLTag } from "./deno-dom/src/dom/types/tags.ts";
export * from "./deno-dom/deno-dom-wasm.ts";
export * from "./deno-dom/src/css/CSSStyleDeclaration.ts"
export * from "./deno-dom/src/css/CSSStylesheet.ts"
export * from "./deno-dom/src/dom/elements/shadow-root.ts";

// create new document
export const document = new denoDom.Document();

// create new element registry
const elements = new CustomElementRegistry<HTMLTag>();
elements.define("H1", denoDom.HTMLHeadingElement)
elements.define("H2", denoDom.HTMLHeadingElement)
elements.define("H3", denoDom.HTMLHeadingElement)
elements.define("H4", denoDom.HTMLHeadingElement)
elements.define("H5", denoDom.HTMLHeadingElement)
elements.define("H6", denoDom.HTMLHeadingElement)
elements.define("FORM", denoDom.HTMLFormElement)
elements.define("VIDEO", denoDom.HTMLVideoElement)
elements.define("INPUT", denoDom.HTMLInputElement)

// create new custom element registry
export const customElements = new CustomElementRegistry();