// deno-lint-ignore-file no-namespace
import { Datex } from "unyt_core";
import { Elements } from "../elements/main.ts";
import { logger, notification_container } from "../utils/global_values.ts";
import { IS_PWA } from "../utils/constants.ts";
import { HTMLUtils } from "../html/utils.ts";
import { Components } from "../components/main.ts";
import { Types } from "../utils/global_types.ts";
import { UIX } from "../uix.ts";
import { UIXComponent } from "../uix_all.ts";


type alert_button = {color?:string, dark_text?:boolean, text:Datex.CompatValue<string>, onClick?:()=>void}


// Actions
export namespace Actions {

    export let is_full_screen = false;
    let active_fullscreen_el: Components.Base;
    let active_fullscreen_el_original_parent: Components.Base;
    let current_address_bar_path = "";

    export async function toggleFullscreen(elem?:Components.Base|UIXComponent, actual_full_screen = true):Promise<boolean > {
        if (is_full_screen) {await exitFullscreen(); return false}
        else {await goFullscreen(elem, actual_full_screen); return true}
    }

    document.addEventListener('fullscreenchange', (e)=>{
        // @ts-ignore
        if (!document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) exitFullscreen();
    });

    export async function goFullscreen(elem?:Components.Base|UIXComponent, actual_full_screen = true): Promise<void>{
        if (!elem) return;
        if (is_full_screen) await exitFullscreen();

        active_fullscreen_el = elem;
        active_fullscreen_el_original_parent = elem.parent;

        document.body.shadowRoot?.append(elem);
        elem.classList.add("full-screen-element");
        elem.classList.add("animate");

        if (actual_full_screen) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            //@ts-ignore
            } else if (elem.mozRequestFullScreen) {
                //@ts-ignore
                elem.mozRequestFullScreen();
            //@ts-ignore
            } else if (elem.webkitRequestFullScreen) {
                //@ts-ignore
                elem.webkitRequestFullScreen();
            //@ts-ignore
            } else if (elem.msRequestFullscreen) {
                //@ts-ignore
                elem.msRequestFullscreen();
            } else {}
        }

        active_fullscreen_el.handleGoFullScreen();
        is_full_screen = true;

    }

    export function exitFullscreen() {
        if(!active_fullscreen_el) {
            logger.error("no active fullscreen element");
            return;
        }

        active_fullscreen_el.classList.remove("animate")
        active_fullscreen_el.classList.remove("animateback")
        active_fullscreen_el.classList.remove("full-screen-element");

        active_fullscreen_el_original_parent.append(active_fullscreen_el);
        active_fullscreen_el.handleExitFullScreen();

        active_fullscreen_el = null;
        is_full_screen = false;

    }

    export function setAddressBarPath(path:string, title?:string){
        if (!IS_PWA) {
            current_address_bar_path = path;
            history.replaceState(title, null, location.origin + '/' + path);
        }
    }
    export function getAddressBarPath() {return current_address_bar_path};

    // portal page change
    export function transitionToURL(url:string) {
        console.log("transition to " + url);
        const portal:any = document.createElement('portal');
        portal.src = url;
        portal.style.width = "100%";
        portal.style.height = "100%";
        portal.style.position = "absolute";
        portal.style.opacity = "0";

        document.body.shadowRoot?.appendChild(portal);

        portal.addEventListener('load', (evt) => {
            setTimeout(()=>{
                logger.info("portal activated: " + url);
                portal.style.opacity = "1";
                portal.activate()
            },2000)
        });

    }


    // internal page navigation (->Breadcrumb)
    const nav = []
    const page_nav_update_listeners = new Set<(nav:Types.nav_entry[])=>void>();
    export function setPageNav(index: number, entry: Types.nav_entry) {
        nav.splice(index);
        nav[index] = entry;
        for (let p of page_nav_update_listeners) p(nav)
    }
    export function addPageNavUpdateListener(listener:(nav:Types.nav_entry[])=>void) {
        page_nav_update_listeners.add(listener)
        listener(nav);
    }

    // menu bar entry updates
    let menu_bar_entries: Types.menu_bar_entries = {}
    const menu_bar_update_listeners = new Set<(menu_bar_entries:Types.menu_bar_entries)=>void>();
    export function setMenuBarEntries(entries:Types.menu_bar_entries) {
        menu_bar_entries = entries;
        for (let l of menu_bar_update_listeners) l(menu_bar_entries)
    }
    export function clearMenuBarEntries() {
        setMenuBarEntries({});
    }
    export function addMenuBarEntriesUpdateListener(listener:(menu_bar_entries:Types.menu_bar_entries)=>void) {
        menu_bar_update_listeners.add(listener)
        listener(menu_bar_entries);
    }

    // new window handling
    export function openElementInNewWindow(element: Components.Base, width = element.offsetWidth, height = element.offsetHeight, x?:number, y?:number) {
        x ??= element.getBoundingClientRect().left + window.scrollX + window.screenLeft
        y ??= element.getBoundingClientRect().top + window.scrollY + window.screenTop
        console.log("opening", element);
        const new_window = window.open("/@uix/window" , '_blank', `top=${y},left=${x},height=${height},width=${width}`)
        // @ts-ignore
        new_window.element_promise = Datex.Compiler.encodeValue(element,undefined,true,false,true);
    }

    // set color theme for PWA
    // if override_use is true, the background will always be enforced (not overriden by other components) until updated again with override_use=true
    let is_enforced = false;
    export function setAppBackground(color:Datex.CompatValue<string>, override_use = true) {
        if (is_enforced && !override_use) return false;
        is_enforced = override_use;
        const meta_theme = <HTMLElement> document.querySelector('meta[name="theme-color"]');
        if (meta_theme) {
            HTMLUtils.setElementAttribute(meta_theme, 'content', color);
        }
        UIX.HTMLUtils.setCSSProperty(document.body, 'background-color', color);
        return true;
    }



    export enum DialogSize {
        DEFAULT,
        DYNAMIC,
        LARGE,
        FULLSCREEN
    }

    let active_dialog_element:HTMLElement
    let active_alert_container:HTMLElement
    let active_on_cancel:Function

    function closeDialog(dialog:HTMLElement){
        // animate out
        dialog.classList.remove("animate")
        if (!active_alert_container?.children.length) active_alert_container.classList.remove("animate")
        
        setTimeout(()=>{
            dialog.remove();
            if (!active_alert_container?.children.length) active_alert_container.remove();
        }, 110)

    }
    export function getActiveDialogElement() {
        return active_dialog_element;
    }

    export function closeActiveDialog(){
        active_alert_container.remove();
        if (active_on_cancel) active_on_cancel();
    }

    export function elementDialog(element: HTMLElement, cancelable=true, onCancel?:()=>void, size?:DialogSize) {
        if (!active_alert_container) active_alert_container = HTMLUtils.createHTMLElement(`<div class="alert-container ${cancelable?"cancelable":""}"></div>`);
        const alert = HTMLUtils.createHTMLElement(`<div class="basic-alert"></div>`);
        active_alert_container.append(alert);

        if (size == DialogSize.DYNAMIC) alert.classList.add("dynamic-alert")
        else if (size == DialogSize.LARGE) alert.classList.add("large-alert")
        else if (size == DialogSize.FULLSCREEN) alert.classList.add("fullscreen-alert")

        alert.append(element)

        active_dialog_element = element;

        //alert.on("click", (e)=>{e.stopPropagation()})

        if (onCancel) active_on_cancel = onCancel;

        const cancel = ()=>{
            closeDialog(alert)
            // // animate out
            // alert.classList.remove("animate")
            // alert_container.classList.remove("animate")
            // setTimeout(()=>alert_container.remove(), 110);
            
            if (onCancel) onCancel()
        }
        if (cancelable) {
            let down = false;
            active_alert_container.addEventListener("mousedown", (e)=>{
                if (e.target == active_alert_container) down = true;
                else down = false;
            });
            active_alert_container.addEventListener("mouseleave", (e)=>{
                down = false;
            });
            active_alert_container.addEventListener("mouseup", (e)=>{
                if (e.target == active_alert_container && down) {
                    cancel()
                }
                down = false;
            });
        }

        // remove on hide event
        element.addEventListener("hide", cancel);


        // slight animation on click outside
        active_alert_container.addEventListener("mousedown", (e)=>{
            if (e.target == active_alert_container) alert.classList.add("animate-half")
        })
        active_alert_container.addEventListener("mouseup", ()=>alert.classList.remove("animate-half"))

        document.body.shadowRoot?.append(active_alert_container);

        // animate
        setTimeout(()=>{
            alert.classList.add("animate")
            active_alert_container.classList.add("animate")
        }, 0);

        return {cancel:cancel}
    }


    // show an in-app notification
    export function notification(title:Datex.CompatValue<string>, body?:Datex.CompatValue<string>, persistant=false) {
        //console.log("NOTIFICATION:", title);

        //body = Utils.escapeHtml(body);

        let close_btn = HTMLUtils.createHTMLElement(`<button class='c-button' style='background:var(--bg_content)'><i class='fa fa-times'></i></button>`)
        HTMLUtils.setCSS(close_btn, {
            position: 'absolute',
            top: '-9px',
            left: '-9px',
            display: 'none'
        })
        
        let timeout;
        let hiding_timeout;
        let triggerHideTimeout = ()=>{
            timeout = setTimeout(()=>{
                notification.style.opacity = '0';
                timeout = setTimeout(()=>{notification.remove()}, 1000);
            }, 8000);
        }

        let notification = HTMLUtils.createHTMLElement(`
        <div class='notification' style='position:relative'>
            <div><h4 style='margin-bottom:5px;margin-top:0px'></h4><div>${body}</div></div>
        </div>`);
        HTMLUtils.setElementText(<HTMLElement>notification.children[0].children[0], title);
        HTMLUtils.setElementText(<HTMLElement>notification.children[0].children[1], body);
        notification.append(close_btn)

        close_btn.addEventListener("click", ()=>notification.remove())

        notification.addEventListener("mouseenter", ()=>{
            if (timeout) clearTimeout(timeout); // dont hide 
            if (hiding_timeout) clearTimeout(hiding_timeout); // dont hide 
            notification.style.opacity = '1';
            close_btn.style.display = 'block'
        })
        notification.addEventListener("mouseleave", ()=>{
            close_btn.style.display = 'none'
            if (!persistant) triggerHideTimeout();
        })

        notification_container.append(notification);

        //if (!document.hasFocus()) new Notification(title, {body: body});

        // remove after some time?
        if (!persistant) triggerHideTimeout()

    }

    // show a dialog with title, body and optional buttons
    export function dialog(title:Datex.CompatValue<string>, body:Datex.CompatValue<string|HTMLElement>, buttons?:alert_button[], cancelable:boolean=true, onCancel?:()=>void){
        // document.querySelector(".alert-container.cancelable")?.remove();

        if (!active_alert_container) active_alert_container = HTMLUtils.createHTMLElement(`<div class="alert-container ${cancelable?"cancelable":""}"></div>`);

        const alert = HTMLUtils.createHTMLElement(`<div class="basic-alert text-alert"></div>`)
        active_alert_container.append(alert);
        const titleEl = HTMLUtils.createHTMLElement(`<div><h3 style="text-align: center">${title??""}</h3></div>`);
        HTMLUtils.setElementText(<HTMLElement>titleEl.children[0], title)
        alert.append(titleEl)
        const bodyEl = HTMLUtils.createHTMLElement(`<div style="flex:1"></div>`);
        if (Datex.Value.collapseValue(body) instanceof HTMLElement) HTMLUtils.setElementHTML(bodyEl, body)
        else HTMLUtils.setElementText(bodyEl, body)
        alert.append(titleEl)
        alert.append(bodyEl);

        let button_div = HTMLUtils.createHTMLElement(`<div style="width: 100%; display: flex;gap:5px"></div>`)
        let i = 0;
        let focus_btn;
        for (let b of buttons??[]) {
            let btn = new Elements.Button({text:b.text, onClick:()=>{
                if (b.onClick) b.onClick();
                closeDialog(alert)
            }, color: b.color??"none", text_color:b.dark_text?"#333":"#eee"});
            btn.style.width = "-webkit-fill-available";
            button_div.append(btn)
            focus_btn = btn;
            i++;
        }

        alert.append(button_div)
        alert.addEventListener("click", (e)=>{e.stopPropagation()})

        const cancel = ()=>{
            closeDialog(alert)
            if (onCancel) onCancel()
        }

        if (cancelable) {
            active_alert_container.addEventListener("click", cancel);
        }

        // slight animation on click outside
        active_alert_container.addEventListener("mousedown", ()=>alert.classList.add("animate-half"))
        active_alert_container.addEventListener("mouseup", ()=>alert.classList.remove("animate-half"))

        document.body.shadowRoot?.append(active_alert_container)

        // animate
        setTimeout(()=>{
            alert.classList.add("animate")
            active_alert_container.classList.add("animate")
        }, 0);    

        focus_btn?.focus();

        return {cancel:cancel}
    }

}
