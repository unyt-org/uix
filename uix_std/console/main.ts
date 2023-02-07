/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  ConsoleView - UIX Standard Lib                                                      ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  provides access to a remote console via mentos                                      ║
 ║  Visit https://docs.unyt.org/unyt for more information                               ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */


// ---

import { UIX, I, S} from "uix";
import { Datex } from "unyt_core";

import MonacoHandler from "uix_std/code_editor/monaco.ts";
import {convertANSIToHTML} from "uix/utils/ansi_to_html.ts"



type log_meta = {format?:string|boolean, color?:string, prepend?:string}

export class LogBuffer {

    private meta_data:{type:string, station_type?:number, name:string};

    private read_promise_resolve:(r:string)=>void;

    public async log(log_data:{origin?:string, tag?:string, data?:any[], meta?:log_meta}) {
        for (let listener of this.log_listeners) await listener(log_data)
    }

    public readInput(log_data:{origin?:string, tag?:string, data?:any[], meta?}):Promise<string> {
        return new Promise<string>(resolve=>{
            this.read_promise_resolve = resolve
            log_data.meta.read_mode = true;
            this.log(log_data);
        });
    }

    setMetaData(meta_data) {
        this.meta_data = meta_data;
        for (let l of this.meta_data_change_listeners) l(this.meta_data);
    }

    getMetaData() {
        return this.meta_data;
    }

    private meta_data_change_listeners = new Set<Function>();
    public onMetaDataChanged(listener:(meta_data)=>void) {
        this.meta_data_change_listeners.add(listener);
    }



    private log_listeners = new Set<Function>();
    public onLog(callback:(origin:string, tag:string, data:any[], meta, read_mode:boolean)=>Promise<string>) {
        this.log_listeners.add(async (log_data:{origin?:string, tag?:string, data?:any[], meta?})=>{
            let read_mode = log_data.meta?.read_mode;
            let res = await callback(log_data.origin, log_data.tag, log_data.data, log_data.meta, read_mode);
            if (read_mode && this.read_promise_resolve) {
                this.read_promise_resolve(res);
                this.read_promise_resolve = null;
            }
        })
    }
}

export namespace ConsoleView{
    export interface CONSOLE_OPTIONS extends UIX.Components.Base.Options {
        station_id?:number // default station to use
        header?:boolean // show a header with more settings / station selection
        timestamps?:boolean // show timestamps?
    }
}

@UIX.Component<ConsoleView.CONSOLE_OPTIONS>({
    vertical_align: UIX.Types.VERTICAL_ALIGN.TOP,
    horizontal_align: UIX.Types.HORIZONTAL_ALIGN.LEFT,
    header: true,
    bg_color: UIX.Theme.getColorReference('bg_console')
})
export class ConsoleView<O extends ConsoleView.CONSOLE_OPTIONS = ConsoleView.CONSOLE_OPTIONS> extends UIX.Components.Base<O> {

    declare container:HTMLElement;
    declare console_body:HTMLElement;
    declare console_header:HTMLElement;

    protected enable_hover = false;
    protected tooltip_formatted = true;

    // use '###' to mark start and end of content sections with hover functionality
    static readonly HOVER_ANCHORS:[string,string] = ['###\x02###', '###\x03###'];
    static readonly HOVER_ANCHOR_REGEXES = [
        /<span class="(\w* *)+">###\x02###<\/span>/gm,
        /<span class="(\w* *)+">###\x03###<\/span>/gm
    ]

    onHover(value:string):Promise<HTMLElement>|HTMLElement{return null} // can be implemented

    _callback = (origin, tag, data, meta)=>this.onConsoleLog(origin, tag, data, meta);

    // @implement: return additional context menu items
    protected createContextMenu() {
        return {
            change_station: {
                text: S`change_station`,
                handler: null,
                disabled: true
            },
            clear_console: {
                text: S`clear_console`,
                shortcut: 'rename',
                handler: ()=>{
                    this.clearConsole()
                }
            },
        }
    }


    private async updateMetaData(meta_data) {
        if (!meta_data) {
            this.console_header.innerHTML = "";
            return;
        }
        this.console_header.innerHTML = `<div><span style="opacity: 0.7">${meta_data.type == "Bluetooth" ? I`fab-bluetooth-b` : (meta_data.type == "Serial" ? I`fab-usb` : I`fas-hdd`)}&nbsp;${meta_data.type=="Remote" ? meta_data.station_type : meta_data.type} </span>${meta_data.name ? " ("+meta_data.name+")" : ""}</div>`
    }

    async setLogBuffer(log_buffer:LogBuffer){
        log_buffer.onLog((origin, tag, data, meta, read_mode)=>this.onConsoleLog(origin, tag, data, meta, read_mode));
        let meta_data = log_buffer.getMetaData();
        this.updateMetaData(meta_data)
        log_buffer.onMetaDataChanged((meta_data)=>{
            this.clearConsole()
            this.updateMetaData(meta_data)
        })
        this.console_body.innerHTML = ""
    }

    private clearConsole(){
        this.console_body.innerHTML = ""
        this.hideAllTooltips(); // reset tooltips
    }

    private hides = new Map<HTMLElement, Function>();
    private persistant_tooltips = new Set<HTMLElement>();

    private async showTooltip (target:HTMLElement) {      

        if (this.hides.has(target)) return; // already expanded

        let content = await this.onHover(target.innerText);

        // show 'tooltip'
        const bounds = target.getBoundingClientRect();
        let height = bounds.height + content.getBoundingClientRect().height/2 + 15;
        this.hides.set(target, UIX.Handlers.showTooltip(content, bounds.left, bounds.top+height, 'right', this.tooltip_formatted).hide);
    };

    private async hideTooltip(target:HTMLElement) {
        if (this.persistant_tooltips.has(target)) return; // is persistant, don't hide
        this.hides.get(target)?.();
        this.hides.delete(target);
    }

    hideAllTooltips(){
        for (let [target, hide] of this.hides) {
            hide?.();
            this.hides.delete(target);
        }
    }

    async onConsoleLog(origin:string, tag:string, data:any[], meta, read_mode:boolean=false){
        let short_time = true;

        let timestamp = meta.time ? meta.time*1000 : undefined;


        let date = short_time ? new Date(timestamp).toLocaleTimeString() : new Date(timestamp).toISOString().replace("T"," ").replace("Z", " ").split(".")[0]
        let time_info = this.options.timestamps ? `<div style="white-space: nowrap;user-select:none;color: #333333;min-width:90px">${date}</div>` : "";

        if (meta.prepend) time_info = `<div style="white-space: nowrap;user-select:none;color: #333333;margin-right: 8px">${meta.prepend.replace(/ /g, "&nbsp")}</div>` + time_info;

        let html_entry = document.createElement("div");
        html_entry.innerText = "..."

        let message_div = document.createElement("div");
        message_div.style.display = "inline-block";

        for (let d=0;d<(read_mode ? 1 :data?.length);d++) {
            message_div.append("<span style='position: relative;float:left;margin-right: 5px;"+(meta.color ? `color:${meta.color}` : "")+"'>" + await this.formatLog(data[d], d, meta.format) + "</span>");
        }

        if (origin!=null && tag!=null) {
            let color = tag; // TODO LOG_COLORS[tag];
            let content = UIX.Utils.createHTMLElement(`<div>${(typeof data[0] == "string" &&  data[0]?.startsWith("$")) ? "" :`<span style="margin-right: 7px; position: relative;float:left;color: ${color[0]}">[${this.escapeHtml(origin)}]</span>`}</div>`);
            content.append(message_div);
            html_entry = <HTMLDivElement> UIX.Utils.createHTMLElement(`<div style="display:flex;flex-direction:row;color: ${color[1]}">${time_info}</div>`);
            html_entry.append(content);
        }
        else {
            html_entry = <HTMLDivElement> UIX.Utils.createHTMLElement(`<div style="display:flex;flex-direction:row;color: ${meta.color ? meta.color: "#aaa"}">${time_info}</div>`);
            for (let d=0; d<(read_mode ? 1 :data?.length);d++) {
                const formatted = await this.formatLog(data[d], d, meta.format);
                if (typeof formatted == "string") html_entry.insertAdjacentHTML('beforeend', formatted);
                else html_entry.append(formatted);
            }
        }

        let p:Promise<any>;

        if (read_mode) {
            let reader = UIX.Utils.createHTMLElement(`<div contenteditable=true style="min-width: 10px;background-color:#1f1f1f"></div>`);
            html_entry.append(reader)
            if (data[1]!==undefined) {
                // closing text after input area
                const formatted = await this.formatLog(data[1], 1, meta.format);
                if (typeof formatted == "string") html_entry.insertAdjacentHTML('beforeend', formatted);
                else html_entry.append(formatted);
            }
            setTimeout(()=>reader.focus(),200);
            p = new Promise(resolve=>{
                reader.addEventListener('keydown', function(e) {
                    if (e.key === "Enter" && e.shiftKey === false) {
                        e.stopPropagation();
                        e.preventDefault()
                        reader.setAttribute("contenteditable", "false");
                        let t = reader.innerText;
                        resolve(t);
                    }
                  });
            })
          
        }

        this.console_body.append(html_entry);
        this.scrollToBottom(true)

        return p;
    }

    escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/>/g, '&gt;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    
    
    /** format a log, using 'markdown' style formatting per default, supports monaco language formatting */
    async formatLog(message, m, type="default"){
        
        // special arraybuffer formatting
        if (message instanceof ArrayBuffer) {
            let decoder = new TextDecoder("utf-8");
            return /*"<" + Array.from(new Uint8Array(message)).map(s=>s.toString(16)).join(" ") + "><br>"*/ decoder.decode(message).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');;
        }

        // formatting
        else if (type == "default" && !(message instanceof HTMLElement)) {
            if (typeof message == "string") {
                if (m == 0 && message.startsWith("$") ) message = message.substring(1);

                message = this.escapeHtml(message)
                    .replace(/\*\*[^*]*\*\*/g, function (x) {
                        return "<b>" + x.replace(/\*/g, "") + "</b>"
                    })
                    .replace(/__[^_]*__/g, function (x) {
                        return  "<span style='text-decoration: underline'>" +x.replace(/_/g, "") + "</span>"
                    })
                    .replace(/\[[^[]*]/, function (x) {
                        return "<span>" + x.replace(/\[/g, '').replace(/]/g, '') + "</span>"
                    })
                    // url
                    .replace(/(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/g, function (x) {
                        return "<a style='margin-left: 4px' href='"+x+"' target='_blank'>" + x + "</a>"
                    })
                    .replace(/[\r\n\x0B\x0C\u0085\u2028\u2029]+/g, '<br>').replace(/ /g , "&nbsp;");
            }
        }

        // ansi formatting
        else if (type == "ansi" && !(message instanceof HTMLElement)) {
            if (typeof message == "string") {
                return UIX.Utils.createHTMLElement(convertANSIToHTML(message));
            }
        }

        // custom language color highlighting
        else if (type && !(message instanceof HTMLElement)) {
            let colorized = await MonacoHandler.colorize(message.toString(), type);
            colorized = colorized
                .replace(ConsoleView.HOVER_ANCHOR_REGEXES[0], '<span class="console-hoverable">')
                .replace(ConsoleView.HOVER_ANCHOR_REGEXES[1], '</span>')
                .replaceAll(ConsoleView.HOVER_ANCHORS[0], '<span class="console-hoverable">')
                .replaceAll(ConsoleView.HOVER_ANCHORS[1], '</span>');

            const div = document.createElement("div");
            div.innerHTML = colorized;
            // hover implemented
            if (this.enable_hover) div.querySelectorAll('.console-hoverable').forEach((el:HTMLElement)=>{
                el.addEventListener("mouseenter", e => this.showTooltip(el));
                el.addEventListener("mouseout", e => this.hideTooltip(el));
                el.addEventListener("click", e => {
                    // now hide if persitant tooltip already exists (toggle click)
                    if (this.persistant_tooltips.has(el)) {
                        this.persistant_tooltips.delete(el);
                        this.hideTooltip(el)
                    }
                    else {
                        this.showTooltip(el)
                        this.persistant_tooltips.add(el)
                    }
                });
            })
            
            return div;
        }
        // simple default escaping
        else if (!(message instanceof HTMLElement)) {
            message = this.escapeHtml(message).replace(/[\r\n\x0B\x0C\u0085\u2028\u2029]+/g, '<br>').replace(/ /g , "&nbsp;");
        }

        return message
    }

    public onInit() {
        this.container = UIX.Utils.createHTMLElement(`<div class="console-view"></div>`);  // custom option handling (=>create span text element)
        this.console_header = this.options.header ? UIX.Utils.createHTMLElement(`<div class="console-header"><div style="visibility: hidden">x</div></div>`) : UIX.Utils.createHTMLElement(`<div>`);
        this.console_body = document.createElement("div");
        this.console_body.classList.add('console-body');
        this.container.append(this.console_header)
        this.container.append(this.console_body)

        this.content.append(this.makeScrollContainer(this.container));   // set element html
        this.console_body.innerHTML = "<div style='user-select:none; width:100%;height: 100%;display: flex;align-items: center;justify-content: center'><img src='https://workbench.unyt.org/unyt_web/assets/no_connection.svg' class='console-placeholder' alt='no connection'></div>";
    }

    protected async onAnchor() {
        await this.adoptStyle(`
            code {
                margin-top: 0!important;
            }
        `)
    }

}

