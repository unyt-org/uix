// deno-lint-ignore-file no-namespace
import { Datex, property, props, text } from "unyt_core";
import { UIX, I, S, SVAL } from "uix";
import { DXBViewerConsole } from "./dxb_viewer_console.ts";
import { DXBViewerInfo } from "./db_viewer_info.ts";

@UIX.Group("Datex")
@UIX.Component<UIX.Components.GridGroup.Options>({title:"Datex Pointer Drawer", bg_color:UIX.Theme.getColorReference('bg_default'), icon:"fa-th", columns:[1], rows:[3,1], border:true, gaps:0, border_radius:10, sealed:false})
@UIX.NoResources
export class PointerDrawer extends UIX.Components.Base {
	// TODO
}
    