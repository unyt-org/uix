// deno-lint-ignore-file no-namespace
import { Datex, property, props, text } from "unyt_core";
import { UIX, I, S, SVAL } from "uix";
import MonacoHandler from "../code_editor/monaco.ts";
import { InterfaceTabGroup } from "./interface_tab_group.ts";
import { DatexPointerList, DatexStaticScopeList, DatexTypeList } from "./value_tree_view.ts";
import { DatexInterface } from "./interface.ts";
import { DatexDataViewer } from "./data_viewer.ts";
import { DatexRuntimeInfo } from "./runtime_info.ts";


// Parent group for complete datex debugging tools
@UIX.Group("Datex")
@UIX.Component<UIX.Components.GridGroup.Options>({title:"Datex Debugger", icon:"fa-exchange-alt", rows:[1], columns: [1,2], gaps:0, sealed:false})
@UIX.NoResources
export class DatexDebugger<O extends UIX.Components.GridGroup.Options = UIX.Components.GridGroup.Options> extends UIX.Components.GridGroup<O> {

    interface_group:UIX.Components.TabGroup;
    pointers_and_scopes_group:UIX.Components.TabGroup;

    override onAssemble() {
        // left & right sections
        let interface_group = new InterfaceTabGroup({identifier:"interface_group"});
        let right_tab_group = new UIX.Components.TabGroup({header_location:'right', editable:false, enable_drop:false}, {gx:1, margin_left:10});

        // pointers and scopes
        let pointers_and_scopes_group = new UIX.Components.GridGroup({title:'Pointers and Public Values', rows:[1,1], columns: [1,1], gaps:5, icon:'fas-dollar-sign', enable_drop:false, sealed:false});
        pointers_and_scopes_group.addChild(new DatexPointerList({border_br_radius:0,border_tr_radius:0, enable_drop:false}, {gh:2}));
        pointers_and_scopes_group.addChild(new DatexStaticScopeList({border_bl_radius:0,border_br_radius:0,border_tl_radius:0, enable_drop:false}, {gx:1}));
        pointers_and_scopes_group.addChild(new DatexTypeList({border_bl_radius:0,border_tl_radius:0,border_tr_radius:0,  enable_drop:false}, {gx:1, gy:1}));

        // binary data viewer group
        right_tab_group.addChild(new DatexDataViewer());
        right_tab_group.addChild(pointers_and_scopes_group);
        right_tab_group.addChild(new DatexRuntimeInfo());

        this.addChild(interface_group)
        this.addChild(right_tab_group)
    }

    async onReady() {
        this.interface_group = <UIX.Components.TabGroup> this.getElementByIdentifier("interface_group");
 
        await MonacoHandler.init(); // load monaco first

        // add local interface
        await Datex.InterfaceManager.enableLocalInterface()

        await this.loadConnectedInterfaces();
    
        //this.interface_group.showTab(this.interface_group.current_max_index-1);

        Datex.InterfaceManager.onNewInterface((interf)=>{
            this.addInterface(interf)
        })
    }

    async addInterface(interf:Datex.ComInterface) {
        // tab for interface already exists?
        for (const interface_el of this.interface_group.elements) {
            if ((<DatexInterface>interface_el).hasInterface(interf)) return;
        }
        let d:DatexInterface;

        // local interface
        if (interf == Datex.InterfaceManager.local_interface) {
            d = new DatexInterface({removable:!interf.persistent, local_interface:true, advanced_view:true});
            await this.interface_group.addChild(d);
        }
        // other
        else {
            // single (main) endpoint
            if (interf.endpoint) {
                d = new DatexInterface({removable:!interf.persistent, local_interface:false, advanced_view:true});
                await d.setDatexOutput(interf);
                await this.interface_group.addChild(d);
            }
            // multiple endpoints
            else {
                let max = 5;
                for (const e of interf.endpoints??[]) {
                    d = new DatexInterface({removable:!interf.persistent, local_interface:false, advanced_view:true});
                    await d.setDatexOutput(interf, e);
                    await this.interface_group.addChild(d);

                    if (max-- == 0) break;
                }
            }
        }
        
    }


    async loadConnectedInterfaces() {
        for (const interf of Datex.CommonInterface.getDirectInterfaces()) {
            await this.addInterface(interf);
        }
    }
}
