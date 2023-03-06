import { Compiler } from "unyt_core/compiler/compiler.ts";
import { Logger } from "unyt_core/utils/logger.ts";
import { HTMLUtils } from "../html/utils.ts";


const logger = new Logger("UnytPen")


export class UnytPen {

    static readonly UNYT_PEN_SERVICE = "fe21b5f3-6b79-4874-867c-9037fa2ef4a7"
    static readonly DX_TRANSFER_CHARACTERISTIC = "6d3d8a38-ffb6-4383-a18f-ff7cedbbcfaa"

    private static connected_bt_devices = []

    /** pair with new UnytPen */
    static async pairNewPen(){
        logger.success("Searching for Unyt Pens...");
        try {
            // @ts-ignore
            const device = await navigator.bluetooth.requestDevice({ filters: [{name: ["Benedikt's UnytPen"]}], optionalServices:[UnytPen.UNYT_PEN_SERVICE]})
            if (device) this.connected_bt_devices.push(device)
        } catch (e){
            logger.error(e)
        }

    }

    /** connect with nearby paired UnytPens or pair new pen if no paired devices found */
    static async connect(){
        // @ts-ignore
        this.connected_bt_devices = await navigator.bluetooth.getDevices()
        console.log("devices", this.connected_bt_devices)
        if (!this.connected_bt_devices.length) await this.pairNewPen();

        // init all pens
        for (let device of this.connected_bt_devices) {
            const gatt = await device.gatt.connect();
            console.log("gatt", gatt)
            const service = await gatt.getPrimaryService(UnytPen.UNYT_PEN_SERVICE);
            console.log("service", service)
            const characteristic = await service.getCharacteristic(UnytPen.DX_TRANSFER_CHARACTERISTIC);
            console.log("characteristic", characteristic);
    
            const value = await characteristic.readValue();
            console.log("value", value)
        }
    }

    static generateDataPad(value:any): UnytPenPad {
        const pad = new UnytPenPad();
        pad.transmitValue(value)
        return pad;
    }

}

export enum UNYT_PEN_PAD_MODE {
    TRANSMIT_DATA
}

export class UnytPenPad {

    private index = 0;
    private transmit_data: (0|1|2|3)[];
    private transmit_interval: any;
    private transmitting = false;

    constructor(){

    }

    private arrayBufferToBinaryArray(arrayBuffer:ArrayBuffer):(0|1|2|3)[]{
        const array = [];
        const uint8 = new Uint8Array(arrayBuffer);
        for (const byte of uint8) {
            array.push(...this.byteToBinaryArray(byte));
        }
        return array;
    }
    private byteToBinaryArray(byte:number):(0|1|2|3)[]{
        return byte.toString(4).padStart(4, '0').split("").map((x)=><0|1|2|3>parseInt(x))
    }

    async transmitValue(value:any){
        this.transmit(UNYT_PEN_PAD_MODE.TRANSMIT_DATA, await Compiler.encodeValue(value))
    }

    transmit(type:UNYT_PEN_PAD_MODE, data?:ArrayBuffer){
        this.transmit_data = [1,0,1,0,1,0];//[...this.byteToBinaryArray(type), ... this.arrayBufferToBinaryArray(data)]
        logger.info("transmit: ", this.transmit_data);
    }

    private dom_elements = new Set<HTMLElement>();

    getHTMLElement(){

        const element = HTMLUtils.createHTMLElement("<div class='unyt-pen-pad'></div>");
        this.dom_elements.add(element);

        if (!this.transmitting) this.startTransmit();

        return element;
    }


    private startTransmit(){
        logger.success("starting transmission")
        this.transmitting = true;
        // this.transmit_data should be loaded after timeout
        setTimeout(()=>this.nextBit(), 300)
    }

    private stopTransmit(){
        logger.success("stopping transmission")
        this.transmitting = false;
    
        clearInterval(this.transmit_interval);
        delete this.transmit_interval;
    }

    private nextBit(){

        if (!this.transmitting || !this.transmit_data) return;
        
        // bit value changed
        if (this.index == 0 || this.transmit_data[this.index] != this.transmit_data[this.index-1]) {
            if (this.transmit_data[this.index] == 0) {
                for (let el of this.dom_elements)  el.style.background = '#000';
            }
            else if (this.transmit_data[this.index] == 1) {
                for (let el of this.dom_elements)  el.style.background = '#fff';
            }
        }

   
        if (this.index >= this.transmit_data.length) {
            this.index = 0;
            //console.log("[transmission cycle end]")
            setTimeout(()=>{
                for (let el of this.dom_elements)  el.style.background = '#ccc';
                setTimeout(()=>this.nextBit(), 50);    
            }, 50);
            
        }

        else {
            this.index ++;
            setTimeout(()=>this.nextBit(), 50);
        }
    }

}