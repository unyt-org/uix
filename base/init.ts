
// global event listeners

import { logger } from "../utils/global_values.ts";
import { IS_HEADLESS, VERSION } from "../utils/constants.ts";

import { State } from "./state.ts";
import { Theme } from "./theme.ts";
import { Datex, f, expose, scope } from "unyt_core";

import { client_type } from "unyt_core/utils/constants.ts";
import { addStyleSheetLink } from "../utils/css_style_compat.ts";

let stage:string|undefined = '?'

if (client_type === "deno") {
	({ stage } = (await import("../app/args.ts")))
}

if (client_type == "browser") {
	await (await import("../session/frontend.ts")).initSession();
}

// @ts-ignore use pre injected uix app metadata
if (globalThis._UIX_appdata) {
	// @ts-ignore globalThis app data
	const appdata = globalThis._UIX_appdata
	if (appdata.backend) appdata.backend = f(appdata.backend);
	if (appdata.host) appdata.host = f(appdata.host);
	State._setMetadata(appdata)
}


// enable DATEX CLI
if (client_type === "deno") Datex.enableCLI();

if (!IS_HEADLESS) {
    // keyboard overlay content (on chrome)
    if ('virtualKeyboard' in navigator) {
        // @ts-ignore
        navigator.virtualKeyboard.overlaysContent = true
    }

    // header meta tag for mobile viewport sizing, allow content over notch
	if (!document.querySelector("meta[name=viewport]")) document.head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>')
    // to change app color
    if (!document.querySelector("meta[name=theme-color]")) document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color"/>')


	// Activate if Safari sucks:
	// if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
	//     window.location.href = "https://www.google.com/chrome/"
	// }
	
	// handle invalid images (TODO) ....

	// watch system theme change
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
		if (Theme.auto_mode) return;
		logger.debug("system color scheme change")
		if (event.matches) Theme.setMode("dark")
		else Theme.setMode("light");
		Theme.auto_mode = true;
	})

	// load document + body style, if not yet added

	const body_style_url = new URL("../style/body.css", import.meta.url).toString();
	const document_style_url = new URL("../style/document.css", import.meta.url).toString();

	if (!IS_HEADLESS && !document.head.querySelector("link[href='"+document_style_url+"']")) addStyleSheetLink(document.head, document_style_url);
	if (!IS_HEADLESS && document.body.shadowRoot && !document.body.shadowRoot.querySelector("link[href='"+body_style_url+"']")) addStyleSheetLink(document.body.shadowRoot, body_style_url);
}


// Debug shortcuts

Res.addShortcut("uix_debug", "ctrl+i")
Handlers.handleShortcut(globalThis.window, "uix_debug", Debug.toggleDebugMode);


Res.addShortcut("uix_theme", "ctrl+t")
Handlers.handleShortcut(globalThis.window, "uix_theme", ()=>{
    if (Theme.mode.val == "dark") Theme.setMode("light")
    else Theme.setMode("dark")
});

Res.addShortcut("uix_lang", "ctrl+l")
Handlers.handleShortcut(globalThis.window, "uix_lang", ()=>{
    if (Datex.Runtime.ENV.LANG == 'en') Datex.Runtime.ENV.LANG = 'de'
    else Datex.Runtime.ENV.LANG = 'en'
});

// reset pointer storage
Res.addShortcut("reset", "ctrl+shift+r")
Handlers.handleShortcut(globalThis.window, "reset", State.resetPage);
// reset pointer storage and endpoint
Res.addShortcut("reset_clear_endpoint", "ctrl+r")
Handlers.handleShortcut(globalThis.window, "reset_clear_endpoint", State.resetPageAndClearEndpoint);

// Unyt Pen

Res.addShortcut("connect_unyt_pen", {macos:"cmd+e", windows:"ctrl+e"})
// debugging shortcuts
Handlers.handleShortcut(globalThis.window, "connect_unyt_pen", async ()=>{
    await UnytPen.connect();
});

// strings and shortcuts
await Res.initShortcuts();

Datex.Unyt.setUIXData(VERSION);