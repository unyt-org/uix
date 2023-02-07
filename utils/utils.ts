import { Datex } from "unyt_core";
import { IS_HEADLESS } from "./constants.ts";

// fallback if structuredClone not supported (!Important not fully compatible with structured clone, only temporary placeholder until implemented in SafARi)
export const structuredClone = globalThis.structuredClone ?? function (object:object) {
    if (typeof object != "object" || object == null) return object;
    return (object instanceof Array) ? [...object] : {...object}
}




// get object-like keys that need to be cloned from the prototype
export function getCloneKeys(object:any):Set<string> {
    const clone_keys = new Set<string>();
    for (let [key, value] of Object.entries(object)) {
        if (value && typeof value == "object") clone_keys.add(key);
    }
    return clone_keys;
}

// required for DEFAULT_OPTIONS prototype
export function assignDefaultPrototype<T extends object>(default_object:T, object:T, clone_keys:Iterable<string> = getCloneKeys(default_object)):T {
    let res_object:T;

    // use provided object
    if (object && Object.keys(object).length) {
        if (default_object && !default_object.isPrototypeOf(object)) Object.setPrototypeOf(object, default_object);
        res_object = object;
    } 
    // default
    else {
        res_object = Object.create(default_object??{});
    }

    // clone non-primitive properties (if only in prototype and not in created object) - ignore DatexValues and pointers
    for (let key of clone_keys) {
        // @ts-ignore
        if (!res_object.hasOwnProperty(key) && res_object[key] === default_object[key] &&  !(
            // don't clone fake primitives
            res_object[key] instanceof Datex.Value || 
            res_object[key] instanceof Datex.Type ||
            res_object[key] instanceof Datex.Target ||
            res_object[key] instanceof Datex.Quantity
        ) && !Datex.Pointer.getByValue(res_object[key])) {
            res_object[key] = structuredClone(res_object[key])
        }
    }

    return res_object;
}



// helper function to iterate over entries of css styledeclaration
export function* iterateStyleDeclaration(style:CSSStyleDeclaration) {
    for (let i = 0; i<style.length; i++) {
        const name = style.item(i);
        yield [name, style.getPropertyValue(name)]
    }
}

export const IS_MOBILE_PORTRAIT = () => (IS_HEADLESS ? false : (window.matchMedia && window.matchMedia('screen and (max-device-width: 767px) and (orientation: portrait)')?.matches ? true : false));