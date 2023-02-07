import { Datex, f } from "unyt_core";
import { Logger } from "unyt_core/datex_all.ts";
import {UIX} from "../../uix.ts";

const logger = new Logger("ext_devices");


@UIX.Component<UIX.Components.GridGroup.Options>({icon:"fab-usb", title: "External Devices", sealed:false}) 
@UIX.NoResources
export class ExternalDeviceManager extends UIX.Components.GridGroup {
    
    bt_list: BluetoothDeviceList
    usb_list: USBDeviceList

    protected override onAssemble() {
        this.bt_list = new BluetoothDeviceList();
        this.usb_list = new USBDeviceList({},{gy:1});
        this.addChild(this.bt_list);
        this.addChild(this.usb_list);
        BluetoothDeviceList
    }

    public override async onAnchor() {
        await super.onAnchor();
        
    }
    
    public async connectToDevice(){

        
    }
    
}

@UIX.Component<UIX.Components.List.Options>({header:true, title:"Connected Bluetooth Devices"}) 
@UIX.NoResources
export class BluetoothDeviceList extends UIX.Components.List {
    

    public override async onAnchor() {
        await super.onAnchor();
        
        this.addEntry({title:"Device 1", body:["Device 1", "x", "y"]})
        this.addEntry({title:"Device 1", body:["Device 2", "x", "y"]})

    }
    
    public async connectToDevice(){
        
    }
    
}

@UIX.Component<UIX.Components.List.Options>({header:true, title:"Connected USB Devices"})
@UIX.NoResources
export class USBDeviceList extends UIX.Components.List {
    

    public override async onAnchor() {
        await super.onAnchor();
        
        // connect to all paired devices
        // @ts-ignore
        for (let port of await navigator.serial.getPorts()) {
            this.addDevice(port);
        }

        // @ts-ignore
        navigator.serial.onconnect = (port)=>{
            console.log("new serial device connected");
            this.addDevice(port.target)
        }

    }

    protected override createContextMenu(): { [id: string]: UIX.Types.context_menu_item; } {
        return {
            add_device: {
                text: "Add new serial device",
                handler: ()=>{this.selectSerialDevice()}
            }
        }
    }
    
    public async selectSerialDevice(){
         
        // allow access to serial port
        // @ts-ignore
        const port = await navigator.serial.requestPort();
        if (port) {
            this.addDevice(port)
        }
    }

    private async addDevice(port:any) {
        logger.success("Adding serial port", port);
        const alias = f("@microcontroller");
        await Datex.InterfaceManager.connect("serial", alias, [port, 74880], false);
        this.addEntry({title:alias.toString(), body:[alias.toString(), "Connected USB device"]})
    }


    override async onEntrySelected(entry: UIX.Components.List.list_view_entry) {

    }
   
}