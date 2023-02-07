import { Logger } from "unyt_core/datex_all";

let logger = new Logger("BLE")

const filterNamePrefix = "UnytPen";

export class BLEListener {

    device
    enc = new TextDecoder();

    char_cache;

    send(data) {
        data = String(data);

        if (!data || !this.char_cache) {
            return;
        }
        logger.debug("sending:", data);

        this.char_cache.writeValue(new TextEncoder().encode(data));
    }

    async connectDevice() {
        if (this.device.gatt.connected) {
            return;
        }

        logger.debug('Connecting to GATT server...');

        let server = await this.device.gatt.connect();
        console.log(server);
        if (!this.device.gatt.connected) this.connectDevice();

        let service = await server.getPrimaryService(0xFFE0);
        // console.log(service);
        this.char_cache = await service.getCharacteristic(0xFFE1);
        console.log(this.char_cache);

        await this.char_cache.startNotifications();
        this.char_cache.addEventListener('characteristicvaluechanged', (event)=> {
            let value = new TextDecoder().decode(event.target.value);
            logger.success(value);
        });
        // setTimeout(()=>{
        //     this.send("0")
        // },500)
    }


    async init(){
        let navigator = (<any>window.navigator);

        /*
        TODO
        await navigator.permissions.request({
          name: "bluetooth-le-scan",
          filters: [{namePrefix: 'MDBT'}],
          keepRepeatedDevices: false,
          acceptAllAdvertisements: false,
        })
         */

        let res = await navigator.bluetooth.requestLEScan({filters:[{namePrefix: '◉'}], keepRepeatedDevices: true})
        console.log(res);

        navigator.bluetooth.addEventListener('advertisementreceived', (event:any) => {
            let data = event.serviceData;
            let device = event.device;
            logger.success(event, new TextDecoder().decode(data.entries().next().value[1]));

            // event.device.watchingAdvertisements = true;
            // event.device.onadvertisementreceived = (e)=>logger.error(e);
        })

        return true;
        // return navigator.bluetooth.requestDevice({
        //     filters: [{services: [0xFFE0], namePrefix:"UnytPen"}],
        // }).
        // then(device => {
        //     logger.success('"' + device.name + '" bluetooth device selected', device);
        //     this.device = device;
        //
        //     this.device.addEventListener('gattserverdisconnected', ()=>{
        //         logger.debug("reconnecting...");
        //         this.connectDevice()
        //     });
        //
        //     this.connectDevice()
        // });
    }

    // init() {
    //
    //     let filters = [{namePrefix: filterNamePrefix}];
    //     let options = {filters:filters};
    //
    //     logger.debug('Requesting Bluetooth Scan with options: ' + JSON.stringify(options));
    //
    //     return new Promise(async resolve => {
    //         try {
    //             let navigator = (<any>window.navigator);
    //             const scan = await (<any>navigator).bluetooth.requestLEScan(options);
    //
    //             // log('Scan started with:');
    //             // log(' acceptAllAdvertisements: ' + scan.acceptAllAdvertisements);
    //             // log(' active: ' + scan.active);
    //             // log(' keepRepeatedDevices: ' + scan.keepRepeatedDevices);
    //             // log(' filters: ' + JSON.stringify(scan.filters));
    //
    //             navigator.bluetooth.addEventListener('advertisementreceived', (event) => {
    //                 logger.success("RECEIVED:", event.manufacturerData);
    //                 event.manufacturerData.forEach((valueDataView, key) => {
    //                     console.log('Manufacturer', key, valueDataView);
    //                 });
    //                 event.serviceData.forEach((valueDataView, key) => {
    //                     console.log('Service', key, valueDataView);
    //                 });
    //             });
    //
    //
    //             // setTimeout(stopScan, 10000);
    //             function stopScan() {
    //                 scan.stop();
    //             }
    //         } catch(error)  {
    //             logger.error('error: ' + error);
    //         }
    //     })
    // }
}