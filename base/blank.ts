import { Datex } from "unyt_core";

console.log("Blank window");
await Datex.Storage.clearAll();

const UIX = (await import('../uix.ts')).UIX;

await Datex.Supranet.connect();

if (globalThis.element_promise) {
    const el = await Datex.Runtime.decodeValue(await globalThis.element_promise);
    console.log("el", el);
    
    if (el instanceof UIX.Components.Base){
        el.anchor();
    }
}