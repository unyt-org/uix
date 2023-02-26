// deno-lint-ignore-file no-namespace
import { Datex } from "unyt_core";
import { UIX, I, S, SVAL } from "uix";
import MonacoHandler from "../code_editor/monaco.ts";
import { DatexEditor } from "./editor.ts";
import { DatexConsoleView } from "./console_view.ts";
import { logger } from "../../utils/global_values.ts";
import { DXBViewer } from "./dxb_viewer.ts";

export namespace DatexInterface {
	export interface Options extends UIX.Components.GridGroup.Options {
		local_interface?: boolean // use local interface
		endpoint?: Datex.Endpoint
		interface_type?: string
	}
}

@UIX.Group("Datex")
@UIX.Component<DatexInterface.Options>({title:"Datex Interface", local_interface:true, icon:undefined, rows:[1,1], columns: [1], gaps:4, sealed:false})
@UIX.NoResources
export class DatexInterface<O extends DatexInterface.Options = DatexInterface.Options> extends UIX.Components.GridGroup<O>{

    override async onAssemble() {
        
        await MonacoHandler.init(); // load monaco first
        this.addStyleSheet(MonacoHandler.standalone_stylesheet);

        // datex editor + console
        const editor = new DatexEditor({identifier:'editor', border_br_radius:0, border_bl_radius:0});
        const console = new DatexConsoleView({identifier:'console', border_tr_radius:0, border_tl_radius:0, header:false, timestamps:false, editor:editor}, {gy:1});

        this.addChild(editor);
        this.addChild(console);
    }

    declare editor:DatexEditor;
    declare console:DatexConsoleView;
    declare binary:DXBViewer

    ready = false;

    public override onInit(): void {
        this.onMessage(()=>{
            console.log("treey interface")
            this.tryConnectInterface();
        }, "RETRY_INTERFACE")
    }
    
    override async onReady() {

        await MonacoHandler.init(); // load monaco first
        this.addStyleSheet(MonacoHandler.standalone_stylesheet);

        this.editor = <DatexEditor> this.getElementByIdentifier("editor")
        this.console = <DatexConsoleView> this.getElementByIdentifier("console")

        this.ready = true;

        await this.tryConnectInterface();
    }

    private async tryConnectInterface() {
        // automatically create and add local interface
        console.log("local_interface",this.options.local_interface,this.options)
        if (this.options.local_interface) {
            await Datex.InterfaceManager.enableLocalInterface();
            await this.setDatexOutput(Datex.InterfaceManager.local_interface);
        }
        else if (this.options.endpoint) {
            for  (const interf of Datex.CommonInterface.getInterfacesForEndpoint(this.options.endpoint, this.options.interface_type)) {
                if (!this.options.interface_type || interf.type == this.options.interface_type) {
                    await this.setDatexOutput(interf, this.options.endpoint);
                    return;
                }
            } 
            for  (const interf of Datex.CommonInterface.getIndirectInterfacesForEndpoint(this.options.endpoint, this.options.interface_type)) {
                if (!this.options.interface_type || interf.type == this.options.interface_type) {
                    await this.setDatexOutput(interf, this.options.endpoint);
                    return;
                }
            } 
            for  (const interf of Datex.CommonInterface.getVirtualInterfacesForEndpoint(this.options.endpoint, this.options.interface_type)) {
                if (!this.options.interface_type || interf.type == this.options.interface_type) {
                    await this.setDatexOutput(interf, this.options.endpoint);
                    return;
                }
            } 
            logger.error("cannot load interface for endpoint " + this.options.endpoint)
        }
    }

     
    private formatTitle(title:string) {
        if (title.length<=30) return title;
        else return title.slice(0, 25) + "…";
    }

    #interf?: Datex.ComInterface

    // send commands from the editor to this interface
    async setDatexOutput(interf: Datex.ComInterface, endpoint?:Datex.Endpoint) {
        this.#interf = interf;
        this.options.endpoint = endpoint ?? interf.endpoint;
        this.options.interface_type = interf.type;

        this.title = '<span style=\'font-size:14px;font-family: Menlo, Monaco, "Courier New", monospace;\'>'+ this.formatTitle(this.options.endpoint?.toString()??"@*") + '</span>' + `<span style='opacity:0.5;white-space: pre;'>&nbsp;|&nbsp;${interf.type}</span>`;
        
        if (this.ready) await this.editor?.setDatexOutput(interf, endpoint);
    }

    hasInterface(interf: Datex.ComInterface) {
        return (this.#interf == interf) || (this.options.endpoint == interf.endpoint && this.options.interface_type == interf.type)
    }

    // log std/in std/out from this endpoint
    async addDatexInput(endpoint: Datex.Endpoint) {
        await this.editor?.addDatexInput(endpoint);
    }

    // log raw datex commands from this endpoint
    async addDatexRawInput(endpoint: Datex.Endpoint) {
        await this.editor?.addDatexRawInput(endpoint);
    }

}