// deno-lint-ignore-file no-namespace
import { datex, Datex, pointer, $$ } from "unyt_core";
import { logger } from "../utils/global_values.ts";
import { ServiceWorker } from "../sw/sw-installer.ts";

import { endpoint_config } from "unyt_core/runtime/endpoint_config.ts";
import { displayInit } from "unyt_core/runtime/display.ts";

const version = eternal ?? $$("unknown");

export namespace State {

    export type app_meta = {
        name?: string,
        description?: string,
        version?: string,
        stage?: string,
        backend?: Datex.Endpoint
    }

    export const APP_META:app_meta = {
        name: undefined,
        description: undefined,
        version: undefined,
        stage: undefined,
        backend: undefined
    }

    type version_change_handler = (version:string, prev_version:string)=>void|Promise<void>;

    /**
     * add handler that is called when the app version changes
     */

    let current_version_change_handler: version_change_handler|undefined;
    let waiting_version_change: Function|undefined;

    export function onVersionChange(handler:version_change_handler) {
        current_version_change_handler = handler;
        if (waiting_version_change) waiting_version_change();
    }

    function handleVersionChange(from:string, to:string) {
        waiting_version_change = async ()=> {
            if (!waiting_version_change) return;
            waiting_version_change = undefined;
            displayInit("Updating App");
            logger.info("app version changed from " + from + " to " + to);
            await ServiceWorker.clearCache();
            if (current_version_change_handler) await current_version_change_handler(from, to);
            window.location.reload();
        }
        if (current_version_change_handler) waiting_version_change(); // call if handler available
        // show ui
        displayInit("Updating App");

        // update if no handler called after some time
        setTimeout(()=>waiting_version_change?.(), 8000);
    }

    export function _setMetadata(meta:app_meta){
        Object.assign(APP_META, meta);
        Datex.Unyt.setAppInfo(meta)
        
        if (meta.version) {
            const prev_version = version.val;
            version.val = meta.version;
            if (prev_version != "unknown" && prev_version != version.val) handleVersionChange(prev_version, version.val)
        }

    }

    /** reset methods */
    export const resetPage = globalThis.reset = async ()=>{
        // reset service worker
        await ServiceWorker.clearCache();


        localStorage.removeItem("uix_skeleton");

        // clear storage
        await Datex.Storage.clearAndReload();
    }

    export const resetPageAndClearEndpoint = globalThis.resetAndClearEndpoint = async ()=>{
        endpoint_config.clear();
        await resetPage()
    }

}