// Global constants
import { Path } from "../utils/path.ts";
import { cache_path } from "unyt_core/runtime/cache_path.ts";

export const IS_HEADLESS = !!globalThis.Deno;

// type window = Window & {HTMLElement: HTMLElement};

// // window, document aliases
// export const window:window = <window> (IS_HEADLESS ? (await import("../server_dom/window.ts")).window : globalThis.window);
// export const document = window.document;
// try { 
// 	// @ts-ignore only works in deno
// 	globalThis.document = document;
// } catch {};

// polyfills
if (!IS_HEADLESS) await import("https://unpkg.com/construct-style-sheets-polyfill@3.1.0/dist/adoptedStyleSheets.js");

// if (!IS_HEADLESS) {
// 	(function attachShadowRoots(root) {
// 		document.querySelectorAll("template[shadowrootmode]").forEach((template:any) => {
// 			const mode = template.getAttribute("shadowrootmode");
// 			const shadowRoot = template.parentNode.attachShadow({ mode });
// 			shadowRoot.appendChild(template.content);
// 			template.remove();
// 			attachShadowRoots(shadowRoot);
// 		});
// 	})(document);
// }

let version = "beta";
try {
    const res = await fetch(new URL("../version", import.meta.url));
    if (res.ok) version = (await res.text()).replaceAll("\n","");
}
catch {}


export const VERSION = version;
export const IS_PWA = IS_HEADLESS ? false : (window.matchMedia && window.matchMedia('(display-mode: standalone)')?.matches ? true : false);
// @ts-ignore TODO: headless platform ? macos/windows currently required for shortcuts
export const PLATFORM = IS_HEADLESS ? 'macos' : window.navigator.userAgentData?.platform?.includes("mac") ? "macos" : "windows";
export const DEFAULT_BORDER_SIZE = 2; // also set in css (.has-border)

// saFaRi
// @ts-ignore
export const SAFARI_COMPATIBILITY_MODE = IS_HEADLESS ? false : (typeof window.webkitConvertPointFromNodeToPage === 'function')
export const PLEEASE_FIREFOX = IS_HEADLESS ? false : navigator.userAgent.indexOf("Firefox") != -1;

export const UIX_CACHE_PATH = new Path('./uix/', cache_path);
if (globalThis.Deno && !UIX_CACHE_PATH.fs_exists) Deno.mkdirSync(UIX_CACHE_PATH, {recursive:true})