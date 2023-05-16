// deno-lint-ignore-file no-namespace
import { Datex, property, props, text } from "unyt_core";
import { UIX, I, S, SVAL } from "uix";
import { dxb_sections } from "./db_viewer_info.ts";
import { logger } from "../../utils/global_values.ts";

@UIX.Group("Datex")
@UIX.Component({
    icon:"fa-th",
    bg_color:UIX.Theme.getColorReference('bg_console')
})
export class DXBViewerConsole extends UIX.Components.Base {
    
    private body:HTMLElement
    private container:HTMLElement;

    private sender_info:HTMLElement;

    scope_history:[Datex.dxb_header, ArrayBuffer, boolean][] = [];

    public override onCreate() {

        if (!globalThis.dxbViewers) globalThis.dxbViewers = [];
        globalThis.dxbViewers.push(this);

        this.container = document.createElement("div");
        this.container.style.width = "100%";
        this.container.style.height = "100%";
        this.container.classList.add("console-view");  // custom option handling (=>create span text element)

        const controls = document.createElement("div");
        controls.style.margin = "20px";
        controls.style.marginBottom = "0";
        controls.style.display = "flex";
        controls.style.justifyContent = "space-between";

        const last_btn = new UIX.Elements.Button({onClick:()=>this.historyGoBack(), content:I`fa-angle-left`, color:'var(--bg_default)'});
        last_btn.style.width = "30px";
        last_btn.style.boxSizing = "border-box";
        controls.append(last_btn)

        this.sender_info = document.createElement("div");
        this.sender_info.style.font = '14px Menlo, Monaco, "Courier New", monospace';
        this.sender_info.style.marginLeft = '10px';
        this.sender_info.style.alignItems = 'center';
        this.sender_info.style.display = 'flex';
        this.sender_info.style.whiteSpace = 'nowrap';

        controls.append(this.sender_info)

        let right = document.createElement("div");
        right.style.whiteSpace = 'pre';
        right.style.marginLeft = '10px';
        right.style.display = 'flex';

        const next_btn = new UIX.Elements.Button({onClick:()=>this.historyGoForward(), content:I`fa-angle-right`, color:'var(--bg_default)'});
        next_btn.style.boxSizing = "border-box";
        next_btn.style.marginRight = "5px";
        next_btn.style.width = "30px";
        const new_btn = new UIX.Elements.Button({onClick:()=>this.historyGoNewest(), content:I`fa-angle-double-right`, color:'var(--bg_default)'});
        new_btn.style.width = "30px";
        new_btn.style.boxSizing = "border-box";

        right.append(next_btn);
        right.append(new_btn)
        controls.append(right);
        
        this.body = document.createElement("div");
        UIX.HTMLUtils.setCSS(this.body, {
            'font-size': '14px',
            'user-select': 'text',
            'padding': '20px',
            'font-family': 'Menlo, Monaco, "Courier New", monospace',
            'height': '100%',
            'box-sizing': 'border-box'
        })
        this.container.append(controls)
        this.container.append(this.makeScrollContainer(this.body))

        this.content.append(this.container);   // set element html

        this.onMessage((type, index:number)=>{
            if (type == "SHOW_DATEX") this.displayBlock(index);
            else if (type == "RESET") this.reset();
            return true; // don't bubble down
        })

        this.reset()
    }

    private reset(){
        let empty = UIX.HTMLUtils.createHTMLElement(`
        <div style="user-select:none;width:100%;height:100%;display:flex;align-items:center;flex-direction:column;justify-content:center;color:var(--border_color);font-size:30px">
            ${I`fa-th`}
            <span style='font-size:20px;text-align: center;font-family: "Roboto";margin-top: 10px;'></span>
        </div>`)

        UIX.HTMLUtils.setElementText(<HTMLElement>empty.children[1], S('no_dxb'))

        this.body.innerHTML = "";
        this.body.append(empty);
        this.sender_info.innerHTML = "";

    }

    private focusOnSection(class_id:string, index:number, sections:dxb_sections, e?:MouseEvent) {
        if (!sections[index]) return;
       
        this.sendMessageUp("SHOW_SECTION", sections[index]);

        this.shadow_root.querySelectorAll(`.dxb-id-${class_id}`).forEach(el=>el.classList.add("inactive","active"));
        this.shadow_root.querySelectorAll(`.dxb-outer-block`).forEach(el=>el.classList.remove("active"));
        this.shadow_root.querySelectorAll(`.dxb-id-${class_id}.dxb-index-${index}`).forEach(el=>el.classList.add("active"));
        this.shadow_root.querySelectorAll(`.dxb-id-${class_id}.dxb-index-${index}`).forEach(el=>el.classList.remove("inactive"));
        (<HTMLElement>this.shadow_root.querySelector(`.dxb-id-${class_id}.dxb-index-${index}`)).focus();

        if(e) e.stopPropagation();
    }

    private generated_html = [];

    private historyGoBack():boolean {
        this.sendMessageUp("GO_BACK");
        return true;
    }

    private historyGoForward():boolean {
        this.sendMessageUp("GO_FORWARD");
        return true;
    }

    private historyGoNewest():boolean {
        this.sendMessageUp("GO_NEWEST");
        return true;
    }

    public displayBlock(index:number) {

    
        // TODO is not a new block - readd listeners!
        /*if (this.generated_html[index]) {
            this.body.html("")
            this.body.append(this.generated_html[index]);
            return;
        }*/

        const dxb = this.scope_history[index][1];
        const header = this.scope_history[index][0];
        const outgoing = this.scope_history[index][2];

        // get buffer parts + header info
        const res = Datex.Runtime.parseHeaderSynchronousPart(dxb);
        if (!(res instanceof Array)) {logger.error("cannot display DXB for redirected DATEX");return;}

        const [_, body_uint8, header_uint8] = res;
        const header_data_view = new DataView(header_uint8.buffer);

        const decompiled = header.encrypted ? '[encrypted]' :  Datex.MessageLogger.decompile(body_uint8, false) //await MonacoHandler.colorize(Datex.Decompiler.decompile(body_uint8, true, true, true, false), "datex");
        const decompiled_plain = header.encrypted ? '[encrypted]' :  Datex.MessageLogger.decompile(body_uint8, false, false)

        const class_id = Date.now() + "" + Math.round(Math.random()*100000000000);

        // get hex representation of buffer
        const hex_buffer = [];
        header_uint8.forEach((val)=>{
            let hex = val.toString(16);
            if (hex.length==1) hex = "0"+hex;
            hex_buffer.push(hex)
        });

        body_uint8.forEach((val)=>{
            let hex = val.toString(16);
            if (hex.length==1) hex = "0"+hex;
            hex_buffer.push(hex)
        });

        this.sender_info.innerHTML = 
            '<span><span>'+(header.encrypted?I('fas-lock')+' ':'')+(!header.signed?I('fas-user-secret')+' ':'')+'</span><b>'+Datex.ProtocolDataTypesMap[header.type]+'</b> ' + (outgoing ? 'to ' + (header.routing?.receivers ? Datex.Runtime.valueToDatexString(header.routing.receivers) : '@*') : 'from ' + (header.sender ?? 'anonymous')) + '</span>';
        

		const block_div = document.createElement("div");
        block_div.style.paddingBottom = '20px';

        const _sender_end:[number] = [0];
        Datex.Compiler.extractHeaderSender(header_uint8, _sender_end);
        const s = _sender_end[0];

        let r = header_data_view.getUint16(s,true); // receiver offset
        if (r == Datex.MAX_UINT_16) r = 0; // flooding, no receivers
        const o = header.signed ? Datex.Compiler.signature_size : 0; // signature offset (has signature?)

        const block_header_size = 18;
        const b = s+2+r+o; // block header start

        const signed_header_start = s+2+r;
        let body_start = b+block_header_size;

        if (header.encrypted) body_start += Datex.Crypto.IV_BUFFER_SIZE;


        const sections:dxb_sections = {
            0: [0, 2, 'var(--blue)', 'Magic Number', "Always has to be 01 64"],
            2: [2, 3, 'var(--purple)', 'Version Number'],
            3: [3, 5, 'var(--light_blue)', 'Block Size', "The size of the whole DATEX block in bytes"],
            5: [5, 6, 'var(--red)', 'TTL', "The number of remaining allowed redirects."],
            6: [6, 7, 'var(--blue)', 'Priority'],
            7: [7, 8, 'var(--purple)', 'Signed/Encrypted', "Signed: 01, Signed & Encrypted: 02, Encrypted: 03, None: 00"],
            8: [8, 9, 'var(--light_blue)', 'Sender Type'],
            9: [9, s, 'var(--light_blue)', 'Sender'],
            [s]: [s, s+2, 'var(--red)', 'Receiver Size', "If the receiver size is FF FF, the message is broadcasted and there is no receivers block following"],
            [r>0?s+2:'ignore']: [s+2, s+2+r, 'var(--red)', 'Receivers'],
            [o>0?s+2+r:'ignore']: [s+2+r, b, 'var(--blue)', 'Signature'],
            [b]: [b, b+4, 'var(--purple)', 'Scope ID'],
            [b+4]: [b+4, b+6, 'var(--light_blue)', 'Scope Block Index'],
            [b+6]: [b+6, b+8, 'var(--light_blue)', 'Scope Block Inc'],
            [b+8]: [b+8, b+9, 'var(--red)', 'Type'],
            [b+9]: [b+9, b+10, 'var(--blue)', 'Flags (, Executable, End of Scope, Device)', "", [1,1,1,5]],
            [b+10]: [b+10, b+18, 'var(--purple)', 'Timestamp'],

            [body_start]: [body_start, hex_buffer.length, 'var(--light_blue)', 'Body'],
        }

        // additional iv if encrypted
        if (header.encrypted) {
            sections[body_start-16] = [body_start-16, body_start, 'var(--red)', 'IV']
        }

        let i = 0;
        let close_section_at:number;
        let current_section:dxb_section;
        
        // ROUTING HEADER starts
        let current_div = UIX.HTMLUtils.createHTMLElement(`<div class="dxb-outer-block"><div style='margin-bottom:10px'>ROUTING HEADER</div></div>`)
        const routing_header = current_div;
        current_div.addEventListener("mousedown", (e)=>{
            this.shadow_root.querySelectorAll(`.dxb-id-${class_id}`).forEach(el=>el.classList.remove("inactive","active"));
            this.shadow_root.querySelectorAll(`.dxb-outer-block`).forEach(el=>el.classList.remove("active"));
            routing_header.classList.add("active");
            this.sendMessageUp("SHOW_HEADER", header)
        });
        block_div.append(current_div);

        let previous_length = 0;

        for (const element of hex_buffer) {
            let left = false;
            let right = false;
            
            // BODY starts
            if (i == body_start) {
                current_div = UIX.HTMLUtils.createHTMLElement(`<div class="dxb-outer-block active" style="margin-top:15px"><div style='margin-bottom:10px'>BODY${header.encrypted?' (encrypted)' :''}</div></div>`)
                block_div.append(current_div);
                // on click BODY
                const body = current_div;
                current_div.addEventListener("mousedown", (e)=>{
                    this.shadow_root.querySelectorAll(`.dxb-id-${class_id}`).forEach(el=>el.classList.remove("inactive", "active"));
                    this.shadow_root.querySelectorAll(`.dxb-outer-block`).forEach(el=>el.classList.remove("active"));
                    body.classList.add("active");
       
                    if (header.encrypted) this.sendMessageUp("SHOW_BODY_ENC", [decompiled, decompiled_plain]);
                    else this.sendMessageUp("SHOW_BODY", [decompiled, decompiled_plain]);
                });
            }

            // SIGNATURE starts
            else if (header.signed && i == signed_header_start) {
                current_div = UIX.HTMLUtils.createHTMLElement(`<div class="dxb-outer-block" style="margin-top:15px"><div style='margin-bottom:10px'>SIGNATURE</div></div>`)
                const header_div = current_div;
                current_div.addEventListener("mousedown", (e)=>{
                    this.shadow_root.querySelectorAll(`.dxb-id-${class_id}`).forEach(el=>el.classList.remove("inactive","active"));
                    this.shadow_root.querySelectorAll(`.dxb-outer-block`).forEach(el=>el.classList.remove("active"));
                    header_div.classList.add("active");
        
                    this.sendMessageUp("SHOW_HEADER", header)
                });
                block_div.append(current_div);
            }

            // HEADER starts
            else if (i == signed_header_start || (header.signed && i == signed_header_start + o)) {
                current_div = UIX.HTMLUtils.createHTMLElement(`<div class="dxb-outer-block" style="margin-top:15px"><div style='margin-bottom:10px'>HEADER</div></div>`)
                const header_div = current_div;
                current_div.addEventListener("mousedown", (e)=>{
                    this.shadow_root.querySelectorAll(`.dxb-id-${class_id}`).forEach(el=>el.classList.remove("inactive","active"));
                    this.shadow_root.querySelectorAll(`.dxb-outer-block`).forEach(el=>el.classList.remove("active"));
                    header_div.classList.add("active");
        
                    this.sendMessageUp("SHOW_HEADER", header)
                });
                block_div.append(current_div);
            }

          
            // create new section
            if (i in sections) {
                current_section = sections[i];
                close_section_at = current_section[1];
                left = true;
                const sub = (i >= body_start?i:0);
                const buffer = hex_buffer.slice(current_section[0], current_section[1]);
                const parsed = new TextDecoder().decode((i >= body_start?body_uint8:header_uint8).subarray(current_section[0]-sub, current_section[1]-sub)).replace(/\p{C}/gu, "<span style='color:var(--text_color_light)'>�</span>");
                current_section[6] = buffer
                current_section[7] = parsed;
            }
            if (close_section_at-1 == i) right = true;

            // display bytes or bits
            const content = (current_section && current_section[5]) ? "{"+Datex.Runtime.convertByteToNumbers(current_section[5], header_uint8[i]).map((v,i)=>v.toString(2).padStart(current_section[5][i], '0')).join(" ")+"}" : element;

            // is currently in a section
            if (current_section) {
                const index = current_section[0];
                const block = UIX.HTMLUtils.createHTMLElement(`<div tabindex="0" class="dxb-id-${class_id} dxb-index-${index} dxb-section ${left?"left":""} ${right?"right":""}" style="${current_section[2] ?"background-color:"+current_section[2]:""}">${content}</div>`);
                const next = current_section[1];
                const prev = current_section[0]-previous_length;

                // set new previous_length, if last block of section 
                if (right) previous_length = current_section[1]-current_section[0];

                current_div.append(block)
                
                block.addEventListener("mousedown", (e)=>{
                    this.focusOnSection(class_id, index, sections, e);
                });

                block.addEventListener("keydown", (e)=>{
                    if (e.key=="ArrowLeft"||(e.shiftKey&&e.key=="Tab")) this.focusOnSection(class_id, prev, sections);
                    else if (e.key=="ArrowRight"||e.key=="Tab") this.focusOnSection(class_id, next, sections);
                    e.preventDefault();
                });
            }
            else {
                current_div.append(`<div class="dxb-id-${class_id} dxb-block">${content}</div>`)
            }

            // end section
            if (close_section_at == i) {
                close_section_at = 0
                current_section = null;
            }
            i++;
        }

        // show body info first
        if (header.encrypted) this.sendMessageUp("SHOW_BODY_ENC",  [decompiled, decompiled_plain]);
        else this.sendMessageUp("SHOW_BODY",  [decompiled, decompiled_plain]);

        this.generated_html[index] = block_div;
        this.body.innerHTML = "";
        this.body.append(block_div);
    }

}
