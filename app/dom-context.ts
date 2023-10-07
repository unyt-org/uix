import { client_type } from "unyt_core/utils/constants.ts";
import { enableDatexBindings } from "../uix-dom/datex-bindings/mod.ts";

export const domContext = client_type == "browser" ? globalThis.window : await import("../uix-dom/dom/mod.ts");
export const {domUtils, bindObserver} = enableDatexBindings(domContext)