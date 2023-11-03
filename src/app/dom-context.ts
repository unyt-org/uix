import { client_type } from "datex-core-legacy/utils/constants.ts";
import { enableDatexBindings } from "../uix-dom/datex-bindings/mod.ts";
import { DOMContext } from "../uix-dom/dom/DOMContext.ts";
import type { BindingOptions } from "../uix-dom/datex-bindings/type-definitions.ts";

import type {} from "./dom-global.ts"

// mapFileURL can later be set
export const bindingOptions:BindingOptions = {}

export const domContext = (client_type == "browser" ? globalThis.window : await import("../uix-dom/dom/mod.ts")) as DOMContext;
export const {domUtils, bindObserver} = enableDatexBindings(domContext, bindingOptions)


// make values available on globalThis
if (client_type !== "browser") {
	Object.assign(globalThis, domContext);
}