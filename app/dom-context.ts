import { client_type } from "unyt_core/utils/constants.ts";
import { enableDatexBindings } from "../uix-dom/datex-bindings/mod.ts";
import { DOMContext } from "uix/uix-dom/dom/DOMContext.ts";

export const domContext = (client_type == "browser" ? globalThis.window : await import("../uix-dom/dom/mod.ts")) as DOMContext;
export const {domUtils, bindObserver} = enableDatexBindings(domContext)


// make values available on globalThis
if (client_type !== "browser") {
	Object.assign(globalThis, domContext);
}