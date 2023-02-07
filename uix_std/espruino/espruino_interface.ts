import {Espruino} from "./espruino_tools/espruino.ts";
import { Logger } from "unyt_core/datex_all.ts";
var logger = new Logger("espruino");

window["Espruino"] = Espruino

type esp_device = {name:string, type:"local"|"remote"};

export enum EspruinoDeviceType {
    BLUETOOTH="Web Bluetooth",
    USB_SERIAL="Web Serial"
}


class Esp {
    private static log_buffer = null//new LogBuffer();

    static decoder = new TextDecoder("utf-8");
    public static available_devices = new Set();

    public static async init(){

        await Espruino.init();
        //logger.success("initialized");

        setTimeout(async ()=>{
            // @ts-ignore
            if (navigator.bluetooth && navigator.bluetooth.getDevices && (await navigator.bluetooth.getDevices()).length){
                this.connect(EspruinoDeviceType.BLUETOOTH);
                // check all 10s if bluetooth device is available
                // setInterval(()=>{
                //     if (!this.bt_device) this.connect(EspruinoDeviceType.BLUETOOTH);
                // }, 10_000);
            }
            // @ts-ignore
            if (navigator.serial && navigator.serial.getPorts && (await navigator.serial.getPorts()).length){
                this.connect(EspruinoDeviceType.USB_SERIAL);
            }
        }, 1000);

    }

    public static async uploadCode(source_code: string) {
        // source_code = `console.log("\\n");\n` + source_code;
        this.exec_stopped = false;
        for (let l of this.device_changed_listeners) l(this.bt_device, "start");

        return new Promise(resolve=>{
            Espruino.callProcessor("transformForEspruino", source_code, (transformed_code)=>{
                Espruino.Core.CodeWriter.writeToEspruino(transformed_code, (res) => {
                    if (res) logger.success("Code successfully uploaded to espruino", res)
                    else logger.error("Code upload to espruino failed", res)
                    resolve(res);
                });
            })
        })

    }


    public static async stopExecution(){
        await this.uploadCode("");
        this.exec_stopped = true;
        for (let l of this.device_changed_listeners) l(this.bt_device, "stop");
        return
    }

    private static device_changed_listeners = new Set<Function>();

    /** Add listener: device added or removed*/
    public static onDeviceChanged(listener:(esp_device:esp_device, action:"add"|"remove"|"stop"|"start")=>void){
        this.device_changed_listeners.add(listener)
    }

    private static addDeviceToList(name:string, type:"local"|"remote"){
        let dev = {name:name, type:type};
        this.available_devices.add(dev);
        for (let l of this.device_changed_listeners) l(dev, "add");
        return dev;
    }

    private static removeDeviceFromList(dev:esp_device){
        this.available_devices.delete(dev);
        for (let l of this.device_changed_listeners) l(dev, "remove");
    }


    /** writes incoming console data to the log buffer */
    public static getLogBuffer() {
        return this.log_buffer
    }

    private static bt_device;
    public static exec_stopped = false;

    /** Connect to Bluetooth / Serial device for console + file writing */
    public static async connect(type:EspruinoDeviceType): Promise<boolean>{
        // Espruino.Core.Serial.devices[1].open(null, s=>this.onBTOpen(s), s=>this.onBTReceive(s), s=>this.onBTDisconnect(s));

        // if (this.bt_device) {
        //     logger.info("already connected to device");
        //     return;
        // }

        // Espruino.Config.MINIFICATION_LEVEL = "SIMPLE_OPTIMIZATIONS";
        Espruino.Config.SAVE_ON_SEND = 0; // 0:Ram, 1:Flash, 3:File

        Espruino.Core.Serial.setSlowWrite(false); /// true

        if (type == EspruinoDeviceType.USB_SERIAL) Espruino.Config.BAUD_RATE = 115200;

        return new Promise(resolve=> {
            Espruino.Core.Serial.open(type, cInfo => {
                if (cInfo != undefined) {
                    this.onOpen(type);
                    resolve(true)
                }
                else {
                    logger.error("BT connection failed");
                    resolve(false)
                }
            },  s => this.onDisconnect(s));
        })
    }

    // Device serial events
    private static onOpen(type:EspruinoDeviceType){
        let device_info = Espruino.Core.Env.getBoardData();
        logger.success("Serial device connected", device_info)
        this.log_buffer.setMetaData({type:type.replace("Web ",""), name:device_info.BOARD});

        if (device_info.portName && this.bt_device?.name == device_info.BOARD) {
            logger.info("(reconnected)");
            return;
        }

        Espruino.Core.Serial.startListening( s => this.onReceive(s));
        this.bt_device = this.addDeviceToList(device_info.BOARD, "local");
    }

    static cached_log = "";

    private static onReceive(bin) {

        if (!(bin instanceof ArrayBuffer)) return;

        let text = this.decoder.decode(bin);

        // logger.success("received:", text)

        this.cached_log += text;
        let cached_log = this.cached_log;
        this.cached_log = ""

        // split by start sequence '[J'
        for (let part of cached_log.split("[J")) {
            this.cached_log += this.formatRawLog(part);
        }
        // console.warn(this.cached_log)

    }

    private static formatRawLog(text:string){
        // console.log("analyzing ", text)

        let tt = text.trim();
        if (tt.length === 0 || tt === "") return "";

        // end sequence found
        if (text.endsWith(">") || text.endsWith("")){ // || tt.endsWith("\n")) {
            text = text.replace(/>[\r\n]?.?$/, "");
            text = text.trim().replace(/^\s+|\s+$/g, ''); // remove " " and newlines

            if (text == "=undefined") return ""; // ignore =undefined line
            if (text.startsWith("[?7l")) return "" // ignore start message

            if (text.startsWith("WARNING: gap set scan error")) return "" // ignore start message
            if (text.startsWith("[?7l")) return "" // ignore start message

            text = text.replace("=undefined", "");

            let is_error = false;
            if (text.startsWith("Uncaught SyntaxError") || text.startsWith("Uncaught ReferenceError") || text.startsWith("Uncaught Error")) is_error = true;

            // send log to observer
            this.log_buffer.log({data:[text], origin:is_error ? "error" : undefined, meta: {format:"javascript", prepend:"console >"}})

            return "";
        } else return text;
    }

    private static onDisconnect(s){
        logger.error("Serial device disconnected", s)
        this.removeDeviceFromList(this.bt_device);
        this.bt_device = null;
    }

}


const espruino = Esp
export default espruino;