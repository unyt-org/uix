// deno-lint-ignore-file no-namespace
import { Datex } from "unyt_core";
import { UIX, I, S, SVAL } from "uix";
import { Resource } from "../../utils/resources.ts";
import MonacoHandler from "../code_editor/monaco.ts";


export namespace DatexValueTreeView {
	export interface Options extends UIX.Components.Tree.Options {
		allowed_namespaces?:string[],
		allowed_types?:Datex.Type[]
	}
}

// Tree View of all active pointers
@UIX.Group("Datex")
@UIX.Component<DatexValueTreeView.Options>({
    title:"Value Tree View", 
    header:true, 
    search:true,
    font: '14px / 18px Menlo, Monaco, "Courier New", monospace',
    enable_entry_drag: true, // elements can be dragged out
    enable_entry_drop: false, // don't drop other items into the tree
    enable_entry_open: false // don't open new view on click
}) 
@UIX.NoResources
export class DatexValueTreeView extends UIX.Components.Tree<DatexValueTreeView.Options> {

    override FILTER_SHOW_INVALID_CHILDREN = true;
    override FILTER_SHOW_INVALID_SIBLINGS = true;

    //override CONTEXT_MENU_HEADER_LEFT = true;

    override isResourceAllowed(resource:Resource) {
        // namespace not allowed (for top level pointers)
        if (this.options.allowed_namespaces &&
            resource.meta.type=="datex_top_level_pointer" && !this.options.allowed_namespaces.includes(resource.meta.reference?.type?.namespace)) {
            return false;
        }
        // type not allowed (for top level pointers)
        if (this.options.allowed_types &&
            resource.meta.type=="datex_top_level_pointer" && !this.options.allowed_types.includes(resource.meta.reference?.type)) {
            return false;
        }
        return true;

    }


    override async onCreate() {
        await MonacoHandler.init(); // load monaco first
        this.addStyleSheet(MonacoHandler.standalone_stylesheet);
        await super.onCreate()
    }


    /** divides an entry into an array of single elements corresponding to the entries (tables) */
    protected override async handleCreateSeparateElementsFromEntry(resource: Resource): Promise<UIX.Components.Base[]> {
        return [await this.handleCreateElementFromResource(resource)];
    }

    protected handleCreateElementFromResource(resource: Resource): Promise<UIX.Components.Base> {
        return new DatexValueTreeView({root_resource_path:resource.path, display_root:true, header:false, title:resource.name, title_color:UIX.Utils.getResourceColor(resource), icon:UIX.Utils.getResourceIcon(resource)});
    }


    private onCopyValue(resource:Resource) {
        // collapse pointer to value
        const value = resource.meta.reference instanceof Datex.Value ? resource.meta.reference.val : resource.meta.reference;
        const evaluated = Datex.Runtime.valueToDatexString(value, true, true);
        navigator.clipboard.writeText(evaluated);
    }

    private onCopyPointerName(resource:Resource) {
        // assume is pointer
        if (resource.meta.reference instanceof Datex.Pointer) {
            const p_name = resource.meta.reference.idString();
            navigator.clipboard.writeText(p_name);
        }
        else logger.error("reference is not a pointer")
    }
    

    private onDeletePointer(resource:Resource) {
        let p_name = resource.name
        if (p_name.startsWith("$")) p_name = p_name.substring(1);

        //if (DatexPointer.get(p_name)) DatexPointer.get(p_name).is_persistant  = false;
    }

    protected override createContextMenuBody(resource: Resource) {
        const context_menu:any = {}
        
        // only pointer entries
        if (resource.meta.type=="datex_top_level_pointer" || resource.meta.reference instanceof Datex.Value) {
            context_menu.copy_pointer_id = {
                text: S`copy_pointer_id`, shortcut: "copy",icon: I`fas-dollar`,
                handler: ()=>this.onCopyPointerName(resource)
            }

        }
        
        // all value entries
        if (resource.meta.type=="datex_value" || resource.meta.type=="datex_top_level_pointer") {
            context_menu.copy_value = {
                text: S`copy_value`, shortcut: "copy_value",icon: I`fas-copy`,
                handler: ()=>{
                    this.onCopyValue(resource)
                }
            };
            /*
            delete_pointer: {
                text: S`delete_pointer`, shortcut: "delete",
                handler:  ()=>this.onDeletePointer(entry)
            }*/
        }

        // if (resource.meta.reference) {
        //     // scan with unyt pen
        //     context_menu.unyt_pen = UIX.Utils.unytPenContextMenuItem(resource.meta.reference);
        // }

        return context_menu
    }
}




@UIX.Group("Datex")
@UIX.Component<DatexValueTreeView.Options>({title:"Pointers", root_resource_path:"dxptr://"})
@UIX.NoResources
export class DatexPointerList extends DatexValueTreeView {}

@UIX.Group("Datex")
@UIX.Component<DatexValueTreeView.Options>({title:"Public Values", root_resource_path:'dxscopes://'}) 
@UIX.NoResources
export class DatexStaticScopeList extends DatexValueTreeView {}

@UIX.Group("Datex")
@UIX.Component<DatexValueTreeView.Options>({title:"Types", root_resource_path:'dxtypes://'}) 
@UIX.NoResources
export class DatexTypeList extends DatexValueTreeView {}