// deno-lint-ignore-file no-namespace
import { Datex, property, props, text } from "unyt_core";
import { UIX, I, S, SVAL } from "uix";
import MonacoHandler from "../code_editor/monaco.ts";
import { logger } from "../../utils/global_values.ts";
import { convertANSIWithDATEXToHTML } from "../../utils/ansi_to_html_datex.ts";

export namespace DatexStorageSectionViewer {
	export interface Options extends UIX.Components.List.Options {
		section?: string // storage section name (pointers or items)
	}
}


@UIX.Group("Datex")
@UIX.Component<DatexStorageSectionViewer.Options>({title:"DATEX Storage", header:true, section: 'items'})
@UIX.NoResources
export class DatexStorageSectionViewer extends UIX.Components.List<DatexStorageSectionViewer.Options> {

    scope_history:[Datex.dxb_header, ArrayBuffer, boolean][] = [];
    
    override onInit() {
        this.title = this.options.section == "pointers" ? "Pointers" : "Items";
    }

    override async onCreate(){
        super.onCreate();
        this.addStyleSheet(MonacoHandler.standalone_stylesheet);

        this.setColumnWidths(['500px', null])
        await this.loadStorageEntries()
    }

    async loadStorageEntries() {
        if (this.options.section == "pointers") {
            for (let key of await Datex.Storage.getPointerKeys()) {
                this.addStorageEntry(key)
            }
        }
        else {
            for (let key of await Datex.Storage.getItemKeys()) {
                this.addStorageEntry(key)
            }
        }
       
    }

    async addStorageEntry(key:string) {
        
        const is_pointer = this.options.section == "pointers";

        const value = is_pointer ? await Datex.Storage.getPointerDecompiled(key, true) : await Datex.Storage.getItemDecompiled(key, true);
        
        if (value==null) {
            logger.error("datex storage item "+key+" is empty");
            return;
        }

        const key_colorized = is_pointer ? (await MonacoHandler.colorize("$"+key, "datex")) : key;

        const value_colorized = UIX.Utils.createHTMLElement('<span style="user-select:text"></span>');
        value_colorized.append(convertANSIWithDATEXToHTML(value));
        this.addEntry({
            id: key,
            title: key,
            body: [
                key_colorized, 
                value_colorized
             ]  
        })
    }

    override onEntrySelected(entry:UIX.Components.List.list_view_entry) {
        
    }

    override onClear() {
        Datex.Storage.clearAll();
    }

    override onSync() {
        this.entries = [];
        this.list_container.innerHTML = "";
        this.loadStorageEntries()
    }

    // @implement: return additional context menu items
    protected override createContextMenu() {
        return {
            clear_storage: {
                text: S`clear_storage`,
                shortcut: 'rename',
                handler: ()=>{
                    this.clear()
                }
            },
        }
    }
}
