// deno-lint-ignore-file no-namespace
import { datex, Datex, pointer, eternal } from "unyt_core";
import { root_container, logger } from "../utils/global_values.ts";
import { Components} from "../components/main.ts";
import { ServiceWorker } from "../sw/sw_installer.ts";

import { endpoint_config } from "unyt_core/runtime/endpoint_config.ts";
import { displayInit } from "unyt_core/runtime/display.ts";

let current_uix_state_name = 'default';

const version = await eternal(()=>"unknown");


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
        Datex.Unyt.setApp(meta.name, meta.version, meta.stage, meta.backend)
        
        if (meta.version) {
            const prev_version = version.val;
            version.val = meta.version;
            if (prev_version != "unknown" && prev_version != version.val) handleVersionChange(prev_version, version.val)
        }

    }


    export function loadingScreen(title?:string, icon_path = "https://cdn.unyt.org/unyt_core@dev/assets/skeleton_grey.svg", border_path?:string) { // "/unyt_web/assets/logo_icon_2_border.svg"
        const bg_color = "var(--bg_loading)";
        document.body.insertAdjacentHTML('beforeend', `
        <div id="loader" style="${bg_color ? 'background-color:'+bg_color+';':''}left:0;top:0;position:fixed;width: 100vw; height: 100vh;">
            <div style="background-size:1.5em 1.5em;background-image:linear-gradient(rgba(100, 100, 100, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(100, 100, 100, 0.02) 1px, transparent 1px);font-family: 'Baloo Thambi 2', sans-serif;user-select:none;display: flex;flex-direction: column;align-items: center; justify-content:center; z-index:100000;width:100%;height:100%;">
                <!--<div class="loading-circle" style="${border_path?'border:none;animation: spin 5.0s linear infinite;background-image: url('+border_path+');':''}"></div>-->
                ${icon_path ? `<img style="width: 70px;" src="${icon_path}"/>` : ''}
                
                <div>
                    <h3 style="margin-top:20px">${title??""}</h3>
                    <!--<div class="loading-bar">
                        <div class="progress-bar"></div>
                    </div>-->
                </div>
                </div>
            </div>
        `)
    }

    
    // export function loadingScreen(title?:string, icon_path = "https://cdn.unyt.org/unyt_core@dev/assets/circle_dark.svg", border_path?:string) { // "/unyt_web/assets/logo_icon_2_border.svg"
    //     const bg_color = "var(--bg_loading)";
    //     document.body.insertAdjacentHTML('beforeend', `
    //         <div id="loader" style="${bg_color ? 'background-color:'+bg_color+';':''}font-family: 'Baloo Thambi 2', sans-serif;user-select:none;left:0;top:0;position:fixed;display: flex;flex-direction: column;align-items: center; justify-content:center; width: 100vw; height: 100vh;z-index:100000">
    //             <div class="loading-circle" style="${border_path?'border:none;animation: spin 5.0s linear infinite;background-image: url('+border_path+');':''}"></div>
    //             ${icon_path ? `<img style="width: 70px;position: absolute;left: 50%;transform: translate(-50%, -50%);top: 50%;" src="${icon_path}"/>` : ''}
    //             <!--<div>
    //                 <h3>${title??""}</h3>
    //                 <div class="loading-bar">
    //                     <div class="progress-bar"></div>
    //                 </div>
    //             </div>-->
    //         </div>
    //     `)
    // }



    let current_progress = 0;

    /** percent in 0-1 */
    export function setLoadingProgress(percent:number) {
        current_progress = percent;
        const progress_bar = <HTMLElement> document.querySelector(".progress-bar")
        if (progress_bar) progress_bar.style.width = (current_progress*100)+"%"
    }

    export function addLoadingProgress(percent:number) {
        current_progress += percent;
        const progress_bar = <HTMLElement> document.querySelector(".progress-bar")
        if (progress_bar) progress_bar.style.width = (current_progress*100)+"%"
    }

    export async function loadingFinished(){
        setLoadingProgress(1);
        document.querySelector("#loader")?.remove();
    }


    export function saveSkeleton(skeleton:string)
    export function saveSkeleton(component:Components.Base<any>)
    export function saveSkeleton(skeleton:string|Components.Base<any>) {
        if (typeof skeleton == "string") localStorage.setItem('uix_skeleton', skeleton);
        else if (skeleton instanceof Components.Base) localStorage.setItem('uix_skeleton', skeleton.getSkeleton());
        //else throw new Error("Invalid type for skeleton") TODO:
    }

    export function getSkeleton() {
        return localStorage.getItem("uix_skeleton")
    }

    export function renderSkeleton(skeleton:string) {
        logger.info("rendering skeleton")//, skeleton)
        root_container.innerHTML = skeleton;
    }

    let current_state: Components.Base;

    // completely reset current uix state
    export async function reset(){
        await Datex.Storage.removeItem('uix_state_'+current_uix_state_name);
    }

    // @deprecated
    export async function saved(new_state_pages:()=>Promise<Components.Base[]|Components.Base[]>, state_name?:string):Promise<Components.Base>
    export async function saved(load_new_state:()=>Promise<Components.Base>|Components.Base, state_name?:string):Promise<Components.Base>
    export async function saved(load_new_state:()=>Promise<Components.Base|Components.Base[]>|Components.Base|Components.Base[], state_name:string = current_uix_state_name):Promise<Components.Base> {

        current_uix_state_name = state_name;

        // in DATEX Storage?
        if (await Datex.Storage.hasItem('uix_state_'+current_uix_state_name)) {
            setLoadingProgress(0.3);
            try {
                current_state = await Datex.Storage.getItem('uix_state_'+current_uix_state_name);
                if (!(current_state instanceof Components.Base)) {
                    logger.error `${current_state}`;
                    throw new Error("UIX state not a valid value (uix:app or a UIX Element)");
                }
                // outer component contraints
                const constraints = await Datex.Storage.getItem('uix_constraints_'+current_uix_state_name);
                if (constraints && current_state instanceof Components.Base) current_state.constraints = constraints;
                root_container.append(current_state); // add to document

                loadingFinished();
                logger.success("app state restored");
                saveSkeleton(current_state);
                setLoadingProgress(0.8);
                return current_state;
            } 
            // corrupt storage or other error while loading state -> reset
            catch (e) {
                console.error(e);
                logger.error("invalid state, resetting app");
            }
          
        }

        if (typeof load_new_state == "function") {
            setLoadingProgress(0.1);
            current_state = <any>await load_new_state();
            // if (!(current_state instanceof Components.Base) && typeof current_state == "object") current_state = new UIXAppInstance(undefined, current_state);
            await Datex.Storage.setItem('uix_state_'+current_uix_state_name, current_state)
            // save constraints for outer component
            if (current_state instanceof Components.Base) {
                current_state.constraints = pointer(current_state.constraints);
                await Datex.Storage.setItem('uix_constraints_'+current_uix_state_name, current_state.constraints);
            }
            root_container.append(<Components.Base>current_state); // add to document
            loadingFinished();
            logger.success("app loaded");
            saveSkeleton(current_state);
            setLoadingProgress(0.8);
            return current_state;
        }
        // else if (typeof load_new_state == "object") {
        //     setLoadingProgress(0.1);
        //     current_state = new UIXAppInstance(undefined, load_new_state);
        //     await Datex.Storage.setItem('uix_state_'+current_uix_state_name, current_state)
        //     root_container.append(current_state); // add to document
        //     loadingFinished();
        //     logger.success("app loaded");
        //     saveSkeleton(current_state);
        //     setLoadingProgress(0.8);
        //     return current_state;
        // }
        else {
            throw Error("Invalid state, must be a function")
        } 
        
    }

    // use instead of State.saved
    export function set(component:Components.Base) {
        current_state = component;
        root_container.append(component); // add to document
        loadingFinished();
        logger.success("app loaded");
        saveSkeleton(component);
    }

    export function exportState(uix_component = current_state){
        return Datex.Decompiler.decompile(Datex.Compiler.encodeValue(uix_component, undefined,true,true), false, false, false, false)
    }

    export async function importState(dx:string){

        const state = await datex(dx);
        if (state instanceof Components.Base) {
            root_container.append(state);
        }
        else {
            logger.error("could not import state, not a UIX element");
        }
        current_state = state;
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

document.body.append(root_container);
