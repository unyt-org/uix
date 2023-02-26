import { Datex } from "unyt_core";
import { UIX } from "uix";
import { DatexDataFlowViewer } from "./data_flow_viewer.ts";
import { DXBViewer } from "./dxb_viewer.ts";

@UIX.Group("Datex")
@UIX.Component<UIX.Components.GridGroup.Options>({title: 'Data Viewer', rows:[1], columns: [1,1], gaps:5, icon:'fa-th', enable_drop:false, sealed:false})
@UIX.NoResources
export class DatexDataViewer extends UIX.Components.GridGroup {

    dxb_viewer?: DXBViewer
    data_flow_viewer?: DatexDataFlowViewer

    // header, dxb, outgoing?
    scope_history:[Datex.dxb_header, ArrayBuffer, boolean][] = [];

    override onAssemble() {
        this.addChild(new DatexDataFlowViewer({identifier:"data_flow_viewer", border_br_radius:0,border_tr_radius:0, enable_drop:false}));
        this.addChild(new DXBViewer({identifier:"dxb_viewer", border_bl_radius:0,border_tl_radius:0, enable_drop:false}, {gx:1}));
    }

    override onReady() {

        if (!this.scope_history) this.scope_history = [];

        this.data_flow_viewer = <DatexDataFlowViewer>this.getElementByIdentifier("data_flow_viewer");
        this.dxb_viewer = <DXBViewer>this.getElementByIdentifier("dxb_viewer");

        this.data_flow_viewer.scope_history = this.scope_history
        this.dxb_viewer.scope_history = this.scope_history

        Datex.IOHandler.onDatexReceived((header, dxb)=>{
            // ignore incoming requests from own endpoint to own endpoint
            const receivers = header.routing?.receivers//?.getPositiveEndpoints();
            if (header.sender == Datex.Runtime.endpoint && receivers?.size == 1 && receivers.has(Datex.Runtime.endpoint) && header.type != Datex.ProtocolDataType.RESPONSE && header.type != Datex.ProtocolDataType.DEBUGGER) return;
            this.sendMessageTo(this.data_flow_viewer, "SHOW_DATEX", this.scope_history.push([header, dxb, false])-1);
        });

        Datex.IOHandler.onDatexSent((header, dxb)=>{
            // ignore outgoing responses from own endpoint to own endpoint
            const receivers = header.routing?.receivers//?.getPositiveEndpoints();
            if (header.sender == Datex.Runtime.endpoint && receivers?.size == 1 && receivers.has(Datex.Runtime.endpoint) && (header.type == Datex.ProtocolDataType.RESPONSE || header.type == Datex.ProtocolDataType.DEBUGGER)) return;
            this.sendMessageTo(this.data_flow_viewer, "SHOW_DATEX", this.scope_history.push([header, dxb, true])-1);
        });
    
        // send messages from data_flow_viewer to dxb_viewer (display a DATEX message, reset)
        this.redirectMessages(this.data_flow_viewer, this.dxb_viewer, "SHOW_DATEX")
        this.redirectMessages(this.data_flow_viewer, this.dxb_viewer, "RESET")

        // send messages from dxb_viewer to data_flow_viewer (select a specific DATEX message)
        this.redirectMessages(this.dxb_viewer, this.data_flow_viewer, "GO_BACK")
        this.redirectMessages(this.dxb_viewer, this.data_flow_viewer, "GO_FORWARD")
        this.redirectMessages(this.dxb_viewer, this.data_flow_viewer, "GO_NEWEST")
    }

}