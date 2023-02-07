import { Datex } from "unyt_core";
import { UIX } from "uix";
import { DatexStorageSectionViewer } from "./storage_section_viewer.ts";

@UIX.Group("Datex")
@UIX.Component<UIX.Components.GridGroup.Options>({title:"Datex Storage Viewer", icon: 'fas-archive', rows:[1,3], columns:[1], sealed:false})
@UIX.NoResources
export class DatexStorageViewer extends UIX.Components.GridGroup {

    scope_history:[Datex.dxb_header, ArrayBuffer, boolean][] = [];
    
    override onAssemble() {
        this.addChild(new DatexStorageSectionViewer({}));
        this.addChild(new DatexStorageSectionViewer({section:'pointers'}, {gy:1}))
    }
}