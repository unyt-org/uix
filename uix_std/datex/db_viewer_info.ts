// deno-lint-ignore-file no-namespace
import { Datex, property, props, text } from "unyt_core";
import { UIX, I, S, SVAL } from "uix";
import MonacoHandler from "../code_editor/monaco.ts";
import { DatexValueTreeView } from "./value_tree_view.ts";
import { convertANSIToHTML } from "../../utils/ansi_to_html.ts";
import { dx_value_manager } from "./resource_manager.ts";

export type dxb_section = [start:number, end:number, color:string, title:string, description?:string, bits?:any[], buffer?:string[], parsed?:string];
export type dxb_sections = {[start_index:number]:dxb_section};

@UIX.Group("Datex")
@UIX.Component<UIX.Components.Base.Options>({
    icon:"fa-th", 
    vertical_align:UIX.Types.VERTICAL_ALIGN.TOP, 
    horizontal_align:UIX.Types.HORIZONTAL_ALIGN.LEFT, 
    padding: 20
})
@UIX.NoResources
export class DXBViewerInfo extends UIX.Components.Base {

    private tree_view!:DatexValueTreeView;
    private title_el!:HTMLElement;
    private outer!:HTMLElement;

    // @implement: return additional context menu items
    protected override createContextMenu() {
        return {
            clear_history: {
                text: S`copy_decompiled_datex`,
                shortcut: 'copy',
                handler: ()=>{
                    this.copyDATEX()
                }
            },
        }
    }

    override onInit(){
        this.addStyleSheet(MonacoHandler.standalone_stylesheet);
    }

    public override onCreate() {
        this.tree_view = new DatexValueTreeView({padding_left:0, padding_top:0, border:false, header:false, border_radius:0, bg_color:null, enable_drop:false}, {margin:0});
    
        this.onMessage((type, data)=>{
            if (type == "SHOW_HEADER") this.showHeader(<Datex.datex_scope> data);
            else if (type == "SHOW_BODY") this.showBody(data);
            else if (type == "SHOW_BODY_ENC") this.showBody(data, true);
            else if (type == "SHOW_SECTION") this.showInfo(<dxb_section> data);
            else if (type == "RESET") this.reset();
            return true; // don't bubble down
        })
    
        this.title_el = document.createElement("h3");

        this.header = new UIX.Elements.Header([{element:this.title_el}]);
        this.header.style.color = 'var(--border-color)';

        this.outer = document.createElement("div");
        this.content.append(this.outer);
        this.reset()
    }

    private reset(){
        this.outer.innerHTML = ""
        this.title_el.style.color = 'var(--border_color)'
        UIX.Utils.setElementText(this.title_el, S('no_dxb'))
        this.content.innerHTML = "";
    }

    public async showHeader(header:Datex.dxb_header) {
        UIX.Utils.setElementText(this.title_el, "HEADER")
        this.content.innerHTML = "";
        this.content.append(this.outer);
        this.outer.innerHTML = ""

        // get resource for header data
        const header_resource = await dx_value_manager.getResourceForValue(header);
        // put tree view back into html + load new data
        this.tree_view.anchor(this.outer);
        this.tree_view.title = "SCOPE";
        await this.tree_view.setResource(header_resource);
    }

    private decompiled?: string

    public showBody(decompiled:[colored: string, plain:string], encrypted=false) {
        this.decompiled = decompiled[1];
        UIX.Utils.setElementText(this.title_el, "BODY" + (encrypted?' (encrypted)': ''))
        this.content.innerHTML = "";
        this.content.append(this.outer);

        this.outer.style.width = "100%"
        this.outer.style.height = "100%"

        const div = document.createElement("div");
        div.style.width = "100%";
        div.style.boxSizing = "border-box";
        div.style.fontSize = "14px";
        div.style.fontFamily = "Menlo, Monaco, monospace";
        div.style.userSelect = "text";
        div.style.marginTop = "10px";
        div.style.padding = "5px";

        div.innerHTML = convertANSIToHTML(decompiled[0])

        this.outer.innerHTML = "";
        this.outer.append(this.makeScrollContainer(div))
    }

    private copyDATEX(){
        console.log("copy datex", this.decompiled);
        UIX.Clipboard.putString(this.decompiled);
    }

    public showInfo(section:dxb_section) {
        
        const div = UIX.Utils.createHTMLElement("<div style='width:100%;height:100%;'></div>");
        const content = UIX.Utils.createHTMLElement("<div style='overflow-y: scroll;width:100%;height: calc(100% - 50px);padding-bottom:20px;position:absolute'></div>");

        const {header} = UIX.Snippets.Header(section[3], section[2]);
        const info = UIX.Utils.createHTMLElement(`<div style="margin-top:20px"></div>`);

        const size = section[1]-section[0];
        info.innerHTML = `
            <table style="all: revert;">
                <tr style="line-height: 1em;"><td style="color:var(--text_color_light)!important; all: revert;padding-right:10px;">Start</td> <td style="all: revert;user-select:text;">${section[0]}</td></tr>
                <tr style="line-height: 1em;"><td style="color:var(--text_color_light)!important; all: revert;padding-right:10px;">End</td>   <td style="all: revert;user-select:text;">${section[1]}</td></tr>
                <tr style="line-height: 1em;"><td style="color:var(--text_color_light)!important; all: revert;padding-right:10px;">Size</td>  <td style="all: revert;user-select:text;">${size} byte${size==1?"":"s"}</td></tr>
            </table>
        `;

        const utf8 = UIX.Utils.createHTMLElement(`<div style="user-select:text;margin-top:20px;background: var(--bg_code);border-radius: 5px; width: calc(100% - 10px);overflow-wrap: break-word;padding: 5px;"></div>`);

        utf8.innerHTML = `${section[7]}`
        
        content.append(info)
        content.append(utf8)

        div.append(header)
        div.append(section[4]??'');
        div.append(content)

        this.content.innerHTML = "";
        this.content.append(div)
    }
    
}