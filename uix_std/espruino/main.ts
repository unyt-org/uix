/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  MCUConnectionHandler - UIX Standard Lib                                             ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  handles connection to an espruino device                                            ║
 ║  --> https://www.espruino.com/                                                       ║
 ║  Visit https://docs.unyt.cc/unyt for more information                                ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

import espruino, {EspruinoDeviceType} from "./espruino_interface.ts";
import {UIX} from "../../uix.ts";
import MonacoHandler from "../code_editor/monaco.ts";
import {ConsoleView} from "../console/main.ts";

import { CodeEditor } from "../code_editor/main.ts";
import { Logger } from "unyt_core/datex_all.ts";
import { I, S } from "../../uix_short.ts";

const logger = new Logger("espruino")

@UIX.Component({
    icon:"fa-plug",
    rows: [1,4],
    columns: [1,3],
    sealed: false
})
@UIX.NoResources
export class MCUInterface extends UIX.Components.GridGroup {

    override onAssemble(){
        let connection_handler = new MCUConnectionHandler();
        let console_view = new ConsoleView({
            start_vertex: [0,1],
            end_vertex: [1,2],
            header: true
        });
        let editor = new CodeEditor({
            start_vertex: [1,0],
            end_vertex: [2,2],
            path: "/otto/appl_game_cool/espruino/demo.ts"
        });

        this.addChild(connection_handler);
        this.addChild(console_view);
        this.addChild(editor);
    }

    override async onCreate(){
        console.warn(this.elements)
        let console_view = <ConsoleView>this.elements[1];
        let log_buffer = espruino.getLogBuffer()
        console_view.setLogBuffer(log_buffer)
    }

}


@UIX.Component({icon:"fa-plug"})
@UIX.NoResources
export class MCUConnectionHandler extends UIX.Components.Base {


    override onCreate() {

        let bl_connect_btn = UIX.HTMLUtils.createHTMLElement(`<input type="button" value="${S`connect_bl`}"/>`)
        let usb_connect_btn= UIX.HTMLUtils.createHTMLElement(`<input style="margin-top: 10px" type="button" value="${S`connect_usb`}"/>`)
        let connection_info = UIX.HTMLUtils.createHTMLElement(`<div style="color:#139055; width:100%; text-align:center; margin-top: 10px"></div>`)

        let container = UIX.HTMLUtils.createHTMLElement(`<div style="display: flex; flex-direction: column"></div>`);
        container.append(bl_connect_btn);
        container.append(usb_connect_btn);
        container.append(connection_info);

        // container.append(`<input type="checkbox" id="switch"><label for="switch" title="Bluetooth"></label>`)


        // *ugly* workaround to first detect the device
        bl_connect_btn.addEventListener("dblclick", ()=>{
            // @ts-ignore
            navigator.bluetooth.requestLEScan({acceptAllAdvertisements:true})
        })

        bl_connect_btn.addEventListener("click", async ()=>{
            // await navigator.bluetooth.requestDevice({acceptAllDevices:true})
            let res = await espruino.connect(EspruinoDeviceType.BLUETOOTH)
            // console.log(res)
        })

        usb_connect_btn.addEventListener("click", async ()=>{
            let res = await espruino.connect(EspruinoDeviceType.USB_SERIAL)
            // console.log(res)
        })

        espruino.onDeviceChanged((d)=>{
            connection_info.innerHTML = `<div style="padding:5px;margin-top:10px;background: #0f111b;border-radius: 4px"><div style="margin-bottom:5px">${d?.name}</div></div>`
            connection_info.querySelector("div").append(SNIPPET_MCU_upload("/otto/appl_game_cool/espruino"));
        });

        this.content.append(container)
    }

}


function SNIPPET_MCU_upload(code_path:string){
    let main_el = UIX.HTMLUtils.createHTMLElement("<div class='additional disabled' style='opacity:1!important;width: 100%; display: inline;justify-content: center;'></div>")

    let upload_btn = UIX.HTMLUtils.createHTMLElement(`<div ${espruino.available_devices.size ? "" : "disabled"}  class="sqr-button additional ${espruino.available_devices.size ? "" : "disabled"}">${I`fa-play-circle`}</div>`);
    let stop_btn = UIX.HTMLUtils.createHTMLElement(`<div ${espruino.available_devices.size ? "" : "disabled"}  class="sqr-button additional ${espruino.available_devices.size ? "" : "disabled"}">${I`fa-stop-circle`}</div>`);

    let settings_btn = UIX.HTMLUtils.createHTMLElement(`<div class="sqr-button additional">${I`fa-cog`}</div>`);
    main_el.append(upload_btn);
    main_el.append(stop_btn);
    main_el.append(settings_btn);

    // set default buttons
    if (espruino.available_devices.size) {
        upload_btn.classList.remove("disabled");
        upload_btn.removeAttribute("disabled")
        upload_btn.style.color = "#139055";
        stop_btn.classList.remove("disabled");
        stop_btn.removeAttribute("disabled")
        stop_btn.style.color = "#c92949";
    }

    espruino.onDeviceChanged((esp_device, action) => {
        if (espruino.available_devices.size) {
            upload_btn.classList.remove("disabled");
            upload_btn.removeAttribute("disabled")
            upload_btn.style.color = "#139055";
            stop_btn.classList.remove("disabled");
            stop_btn.removeAttribute("disabled")
            stop_btn.style.color = "#c92949";
        }
        else {
            upload_btn.classList.add("disabled");
            upload_btn.setAttribute("disabled", "true")
            upload_btn.style.color =  "#ababab";
            stop_btn.classList.add("disabled");
            stop_btn.setAttribute("disabled", "true")
            stop_btn.style.color = "#ababab";
        }
        if (action=="stop") {
            stop_btn.classList.add("disabled");
            stop_btn.setAttribute("disabled", "true")
            stop_btn.style.color = "#ababab";
        }
        else if(action=="start") {
            stop_btn.classList.remove("disabled");
            stop_btn.removeAttribute("disabled")
            stop_btn.style.color = "#c92949";
        }
    })

    stop_btn.addEventListener("click", async ()=>{
        if (!espruino.available_devices.size || espruino.exec_stopped) return;

        await espruino.stopExecution();
    })

    upload_btn.addEventListener("click", async ()=>{
        if (!espruino.available_devices.size) return;

        let main_js_file;
        for (let child of /*JSONTree.getEntry(code_path)?.children||*/[]) {
            if (child.path.endsWith(".ts")) {
                if (main_js_file) {
                    logger.error("more than one .js file found")
                    return;
                }
                else main_js_file = child.path;
            }
        }
        let js_content = await MonacoHandler.getFileContent(main_js_file);
        await espruino.uploadCode(js_content);
    })

    return main_el;
}
