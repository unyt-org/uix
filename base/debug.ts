// deno-lint-ignore-file no-namespace
import { IS_HEADLESS } from "../utils/constants.ts";

import "../html/deno_dom.ts";

export namespace Debug {

    export let DEBUG_MODE = !!globalThis.localStorage?.uix_debug;

    // debug mode listeners
    const debug_mode_on_handlers = new Set<Function>()
    const debug_mode_off_handlers = new Set<Function>()
    const debug_mode_style_creators = new Set<()=>string[]>()
    export function onDebugModeOn(handler:Function) {debug_mode_on_handlers.add(handler)}
    export function onDebugModeOff(handler:Function) {debug_mode_off_handlers.add(handler)}
    // inject custom css style rules in debug mode
    export function createDebugModeStyleRules(handler:()=>string[]) {debug_mode_style_creators.add(handler)}


    // UIX Debugging 

    // blue border for content-element
    // red border for slots
    // edit overlays: magenta
    // scroll container: green

    let rule_start_index = 0;
    let rule_count = 0;

    const document_debug_style = new window.CSSStyleSheet();
    if (!IS_HEADLESS) document.adoptedStyleSheets = [...document.adoptedStyleSheets, document_debug_style];

    export function toggleDebugMode(){
        if (DEBUG_MODE) disableDebugMode();
        else enableDebugMode();
    }
    export function enableDebugMode(){
        DEBUG_MODE = true;
        localStorage.uix_debug = true

        rule_start_index = document_debug_style.cssRules.length;

        document_debug_style.insertRule(`.content-element {
            outline: 2px solid blue;
            outline-offset: -3px;
        }`,document_debug_style.cssRules.length)

        document_debug_style.insertRule(`.grid-element:focus .edit-overlay, .edit-overlay:hover {
            background-color: #ee00ff88;
            outline: 1px solid #ffffff88;
        }`,document_debug_style.cssRules.length)

        document_debug_style.insertRule(`slot {
            outline: 3px solid red;
            outline-offset: -2px;
        }`,document_debug_style.cssRules.length)

        document_debug_style.insertRule(`.uix-scrollbar-container {
            background-color:#28d8241a;
        }`,document_debug_style.cssRules.length)

        document_debug_style.insertRule(`.uix-scrollbar {
            opacity: 1;
            display: block;
            background-color:#aaff99;
        }`,document_debug_style.cssRules.length)

        document_debug_style.insertRule(`.ghost-element {
            background: #00d3d352;
        }`,document_debug_style.cssRules.length)

        document_debug_style.insertRule(`.content-element {
            outline: 2px solid blue;
            outline-offset: -3px;
        }`,document_debug_style.cssRules.length)

        rule_count = 6;

        // custom rules
        for (const handler of debug_mode_style_creators) {
            const rules = handler();
            for (const rule of rules) {
                document_debug_style.insertRule(rule,document_debug_style.cssRules.length)
                rule_count ++;
            }
        }

    }

    export function disableDebugMode(){
        DEBUG_MODE = false;
        delete localStorage.uix_debug;

        if (rule_count) for (let i=rule_start_index; i<=rule_start_index+rule_count; i++) document_debug_style.deleteRule(rule_start_index);
    }

}