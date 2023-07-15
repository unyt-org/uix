
// global event listeners

import { global_states, logger, notification_container, unsaved_components } from "../utils/global_values.ts";
import { IS_HEADLESS, VERSION } from "../utils/constants.ts";
import { Handlers } from "./handlers.ts";
import { Res } from "./res.ts";

import { State } from "./state.ts";
import { Theme } from "./theme.ts";
import { Datex, expose, scope } from "unyt_core";
import { Actions } from "./actions.ts";
import { Components } from "../components/main.ts";
import { Debug } from "./debug.ts";
import { UnytPen } from "./unyt_pen.ts";
import { addStyleSheetLink } from "../uix_all.ts";

// enable DATEX CLI
if (globalThis.Deno) Datex.enableCLI();

if (!IS_HEADLESS) {
	window.addEventListener("keydown", (e)=>{
		if (e.key == "Shift") {
			global_states.shift_pressed = true;
		}
		else if (e.key == "Meta") {
			global_states.meta_pressed = true;
		}
	})
	
	window.addEventListener("keyup", (e)=>{
		if (e.key == "Shift") {
			global_states.shift_pressed = false;
		}
		  else if (e.key == "Meta") {
			global_states.meta_pressed = false;
		}
	})
	
	window.addEventListener("mousemove", (e)=>{
		global_states.mouse_x = e.clientX;
		global_states.mouse_y = e.clientY;
	})
	
	window.addEventListener("blur", (e)=>{
		global_states.shift_pressed = false;
		global_states.meta_pressed = false;
	})


	window.onkeydown = (e) => {
		if(e.key == "F6") {
			Actions.toggleFullscreen()
		}
		if(e.key == "Escape") {
			Actions.exitFullscreen()
		}
	}

    // keyboard overlay content (on chrome)
    if ('virtualKeyboard' in navigator) {
        // @ts-ignore
        navigator.virtualKeyboard.overlaysContent = true
    }

    // header meta tag for mobile viewport sizing,  allow content over notch
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

	window.addEventListener("beforeunload", function (e) {
		if (unsaved_components.size==0) {
			return undefined;
		}
	
		let confirmationMessage = 'You have unsaved changes';
	
		(e || globalThis.event).returnValue = confirmationMessage;
		return confirmationMessage;
	});

	// load document + body style, if not yet added

	const body_style_url = new URL("../style/body.css", import.meta.url).toString();
	const document_style_url = new URL("../style/document.css", import.meta.url).toString();

	if (!IS_HEADLESS && !document.head.querySelector("link[href='"+document_style_url+"']")) addStyleSheetLink(document.head, document_style_url);
	if (!IS_HEADLESS && document.body.shadowRoot && !document.body.shadowRoot.querySelector("link[href='"+body_style_url+"']")) addStyleSheetLink(document.body.shadowRoot, body_style_url);
}

// uix.stage
const stage = await datex`
	function (options) (
		use currentStage from #public.uix;

		printf options;
		always options.(currentStage) default @@local
	);
`

@scope("uix") class UIXDatexScope {
    @expose static setMode(theme:"light"|"dark"){
        console.log("setting UIX mode: " + theme);
        Theme.setMode(theme);
    }

    @expose static anchor(element:any){
        element.anchor();
    }

    @expose 
    static set MODE(theme:"light"|"dark"){
        console.log("setting UIX mode: " + theme)
        Theme.setMode(theme);
    }
    static get MODE(){
        return Theme.mode
    }

    @expose static LANG = "en";

	@expose static stage = stage

	@expose static currentStage = "dev"
}
globalThis.UIXDatexScope = UIXDatexScope



// after global_stylesheet loaded
if (Debug.DEBUG_MODE) Debug.enableDebugMode();




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