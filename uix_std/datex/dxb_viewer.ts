// deno-lint-ignore-file no-namespace
import { Datex, property, props, text } from "unyt_core";
import { UIX, I, S, SVAL } from "uix";
import { DXBViewerConsole } from "./dxb_viewer_console.ts";
import { DXBViewerInfo } from "./db_viewer_info.ts";

@UIX.Group("Datex")
@UIX.Component<UIX.Components.GridGroup.Options>({title:"Datex Binary Viewer", bg_color:UIX.Theme.getColorReference('bg_default'), icon:"fa-th", columns:[1], rows:[3,1], border:true, gaps:0, border_radius:10, sealed:false})
@UIX.NoResources
export class DXBViewer extends UIX.Components.GridGroup {
    
    public main!:DXBViewerConsole;
    private info!:DXBViewerInfo;

    #scope_history:[Datex.dxb_header, ArrayBuffer, boolean][] = [];

    set scope_history(scope_history:any[]) {
        this.#scope_history = scope_history;
        if (this.main) this.main.scope_history = scope_history;
    }

    // @implement
    override onAssemble() {
        // dxb viewer
        const main = new DXBViewerConsole({identifier:"main", border_br_radius:0, border_bl_radius:0, border_tl_radius:0, border:false});
        const info = new DXBViewerInfo({identifier:"info", border_tl_radius:0, border_tr_radius:0, border_bl_radius:0, border:false, border_top:true}, {gy:1});

        this.addChild(main);
        this.addChild(info);
    }


    // @implement
    public override onReady() {

        this.main = <DXBViewerConsole>this.getElementByIdentifier("main");
        this.info = <DXBViewerInfo>this.getElementByIdentifier("info");
        
        this.main.scope_history = this.#scope_history;

        // redirect messages from console to info viewer
        this.redirectMessages(this.main, this.parent);
        this.redirectMessages(this.main, this.info, "SHOW_HEADER");
        this.redirectMessages(this.main, this.info, "SHOW_BODY");
        this.redirectMessages(this.main, this.info, "SHOW_BODY_ENC");
        this.redirectMessages(this.main, this.info, "SHOW_SECTION");
    }

}