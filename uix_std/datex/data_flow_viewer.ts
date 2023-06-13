// deno-lint-ignore-file no-namespace
import { Datex, property, props, text } from "unyt_core";
import { UIX, I, S, SVAL, IEL, unsafeHTML } from "uix";
import MonacoHandler from "../code_editor/monaco.ts";
import { logger } from "../../utils/global_values.ts";

@UIX.Group("Datex")
@UIX.Component<UIX.Components.List.Options>({title:"Data Flow Viewer", show_title:false, header:true})
@UIX.NoResources
export class DatexDataFlowViewer extends UIX.Components.List {

    scope_history:[Datex.dxb_header, ArrayBuffer, boolean][] = [];
    
    override onCreate(){
        super.onCreate();
        this.addStyleSheet(MonacoHandler.standalone_stylesheet);

        this.onMessage((type, data:number)=>{
            if (type == "SHOW_DATEX") this.addMessage(data)
            else if (type == "GO_BACK") this.selectPrevious();
            else if (type == "GO_FORWARD") this.selectNext();
            else if (type == "GO_NEWEST") this.selectLast();
            return true; // don't bubble down
        })

        this.setColumnWidths(['25px', '145px', null, '100px', '30px', '30px', '80px'])
    }

    async addMessage(index:number) {
        const header = this.scope_history[index][0];

        if (!header) {
            logger.error("no header", this.scope_history[index]);
            return;
        }

        const type = Datex.ProtocolDataTypesMap[header.type]
        const encrypted = header.encrypted ? ' ' + I('fas-lock'):'';
        const unsigned = !header.signed ? ' ' + I('fas-user-secret'):'';

        const scope_id = header.sid;
        const time = header.timestamp?.toLocaleTimeString();

        const outgoing = this.scope_history[index][2];
        const endpoint = await MonacoHandler.colorize(outgoing ? (header.routing?.receivers ? Datex.Runtime.valueToDatexString(header.routing.receivers)?.replace(/^\(/,'').replace(/\)$/,''):"@*") :  header.sender?.toString()||"anonymous", "datex")

        this.addEntry({
            id: index,
            title:`${type} ${header.sender}`,
            body: [
                outgoing ? IEL('fa-arrow-right') :  IEL('fa-arrow-left'), 
                HTML`<span style='display: flex;align-items:center;justify-content:space-between'><b>${type}</b><span>${unsafeHTML(encrypted)}${unsafeHTML(unsigned)}</span></span>` as HTMLElement,
                HTML`<span style='font-family:Menlo, Monaco, "Courier New", monospace;'>${unsafeHTML(endpoint)}</span>` as HTMLElement,
                HTML`<span style='display: flex; justify-content: end;'>${scope_id}</span>` as HTMLElement,
                HTML`<span style='color:var(--text_color_light);display: flex; justify-content: end;'>${header.return_index}</span>` as HTMLElement,
                HTML `<span style='color:var(--text_color_light);display: flex; justify-content: end;'>${header.inc}</span>` as HTMLElement,
                HTML`<span style='color:var(--text_color_light)'>${time}</span>` as HTMLElement,
             ]  
        })
    }

    override onEntrySelected(entry:UIX.Components.List.list_view_entry) {
        this.sendMessageUp("SHOW_DATEX", entry.id)
    }

    override onClear(){
        this.sendMessageUp("RESET")
    }

    // @implement: return additional context menu items
    protected override createContextMenu() {
        return {
            clear_history: {
                text: S`clear_history`,
                shortcut: 'rename',
                handler: ()=>{
                    this.clear()
                }
            },
        }
    }
}