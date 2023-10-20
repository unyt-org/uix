import { Datex } from "datex-core-legacy";
import { Component } from "../components/Component.ts";

console.log("Blank window");
await Datex.Storage.clearAll();

await Datex.Supranet.connect();

if (globalThis.element_promise) {
    const el = await Datex.Runtime.decodeValue(await globalThis.element_promise);
    console.log("el", el);
    
    if (el instanceof Component){
        document.body.append(el);
    }
}