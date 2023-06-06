// deno-lint-ignore-file no-namespace
import { $$, Datex, f } from "unyt_core";
import { UIX, I, S, SVAL } from "uix";
import MonacoHandler from "../code_editor/monaco.ts";
import { DatexEditor } from "./editor.ts";
import { DatexConsoleView } from "./console_view.ts";
import { logger } from "../../utils/global_values.ts";
import { DXBViewer } from "./dxb_viewer.ts";
import { getExampleScript } from "./example_script.ts";

export namespace DatexInterface {
	export interface Options extends UIX.Components.GridGroup.Options {
		local_interface?: boolean // use local interface
		endpoint?: Datex.Endpoint,
        advanced_view?: boolean // display advanced DATEX settings
        view_v2?: boolean,
		interface_type?: string,
	}
}

export const sharedScriptEndpoint = $$(Datex.LOCAL_ENDPOINT);

@endpoint(sharedScriptEndpoint) class SharedScripts {
    @property static get(id:string, lang?:string, content?:string):Datex.Return<Datex.CompatValue<string>> {}
    @property static getNewId():Datex.Return<string> {}
}

@UIX.Group("Datex")
@UIX.Component<DatexInterface.Options>({title:"Datex Interface", enable_routes:true, advanced_view:false, local_interface:true, icon:undefined, rows:[1,1], columns: [1], gaps:4, sealed:false})
@UIX.NoResources
export class DatexInterface<O extends DatexInterface.Options = DatexInterface.Options> extends UIX.Components.GridGroup<O>{

    @property content_id!: string

    protected override async onConstruct() {
        this.content_id = await this.getValidId();
    }

    override async onAssemble() {
        
        await MonacoHandler.init(); // load monaco first
        this.addStyleSheet(MonacoHandler.standalone_stylesheet);

        // datex editor + console
        const editor = new DatexEditor({identifier:'editor', view_v2:this.options.view_v2, advanced_view:this.options.advanced_view, border_br_radius:0, border_bl_radius:0});
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

        this.loadScript();
    }
    

    private async loadScript(content?:string){
        try {
            const script = await SharedScripts.get(this.content_id, Datex.Runtime.ENV.LANG, content);

            if (script) {
                this.editor.setContent(script);
            }
        }
        catch {
            // maybe offline or endpoint not reachable, set default content if none set
            if (!this.editor.getContent()) this.editor.setContent(getExampleScript(Datex.Runtime.ENV.LANG, this.content_id));
        }
        
    }
    
    override getInternalRoute(): string[] {
        return [this.content_id]
    }

    override onRoute(identifier: string) {
        console.log("on route",identifier)
        this.setContent(identifier);
        return undefined;
    }

    async setContent(id?:string, content?:string) {

        if (!id) id = await this.getValidId();

        if (id != this.content_id) {
            console.log("new content id", id)
            this.content_id = id;
            await this.loadScript(content);
            UIX.Routing.update();
        }
    }

    private async getValidId() {
        try {
            return <string> await SharedScripts.getNewId();
        } catch {
            return this.generateOfflineId();
        }
    }

    private generateOfflineId(length = 10) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < length) {
          result += characters.charAt(Math.floor(Math.random() * charactersLength));
          counter += 1;
        }
        return "offline-"+result;
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