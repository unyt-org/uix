import type { Datex } from "unyt_core"

import { DX_PTR } from "unyt_core/runtime/constants.ts";
import { STANDALONE } from "../snippets/bound_content_properties.ts";

/**
 * Wraps a function so that it is always called in the original context.
 * 
 * In standalone mode, the function is always called on the backend endpoint.
 * 
 * This is the default behaviour when setting event listeners in JSX.
 * 
 * - uses datex-over-http when DATEX is not available
 * - parameters must be json compatible
 * @param fn
 */
export function bindToOrigin<F extends (...args:any)=>any>(fn: F, context?:any, name?:string, forceDatex = false): F extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<Promise<R>>> : never  {
	if (typeof fn !== "function") throw new Error("UIX.bindToOrigin: must be a function");
	
	// @ts-ignore already bound
	if (fn.uix_bound || fn.ntarget?.uix_bound) return <any>fn;

	// @ts-ignore
	if (context) fn = fn.bind(context);
	// @ts-ignore
	fn = $$(fn);
	// @ts-ignore
	const ptr:Datex.Pointer = (globalThis.Datex ? Datex.Pointer.getByValue(fn) : fn[DX_PTR]) ?? fn.ntarget?.[DX_PTR];
	if (!ptr) throw new Error("UIX.bindToOrigin: function must be bound to a DATEX pointer");
	// prevent garbage collection
	ptr.is_persistant = true;
	
	if (forceDatex) {
		fn.toString = ()=>{
			return `async ${name??'function'} (...args) {
				await import("unyt_core");
				await Datex.Supranet.connect();
				return datex('${ptr.idString()}(?)', [args]);
			}`
		}
	}
	else {
		fn.toString = ()=>{
			return `async ${name??'function'} (...args) {
				// use datex
				if (globalThis.datex && globalThis.Datex) {
					await Datex.Supranet.connect();
					return datex('${ptr.idString()}(?)', [args]);
				}
				// use datex-over-http
				else {
					const dx = "${ptr.idString()}("+JSON.stringify(args).slice(1,-1)+")";
					const res = await fetch("/@uix/datex/"+encodeURIComponent(dx));
					const text = await res.text();
					if (res.ok) {
						try {return JSON.parse(text)}
						catch {return "Return value is not valid JSON"}
					}
					else throw new Error(text)
				}
				
			}`
		}	
	}

	return <any>fn;
}



/**
 * Wraps a value so that it is always loaded from the original context.
 * 
 * - uses datex-over-http when DATEX is not available
 * @param fn
 */
export function getValueInitializer(value:any, forceDatex = false): string {
	
	value = $$(value);
	// @ts-ignore
	const ptr:Datex.Pointer = value.idString ? value : (globalThis.Datex ? Datex.Pointer.getByValue(value) : value[DX_PTR]);
	if (!ptr) throw new Error("UIX.getValueInitializer: value must be bound to a DATEX pointer");
	// prevent garbage collection
	ptr.is_persistant = true;
	
	if (forceDatex) {
		return `await (async () => {
			await import("unyt_core");
			await Datex.Supranet.connect();
			return datex('${ptr.idString()}');
		})()
		`
	}
	else {
		return `await (async () => {
			// use datex
			if (globalThis.datex && globalThis.Datex) {
				await Datex.Supranet.connect();
				return datex('${ptr.idString()}');
			}
			// use datex-over-http
			else {
				const res = await fetch("/@uix/datex/"+encodeURIComponent("${ptr.idString()}"));
				const text = await res.text();
				if (res.ok) {
					try {return JSON.parse(text)}
					catch {return "Value is not valid JSON"}
				}
				else throw new Error(text)
			}
		})()
		`
	}
}


/**
 * Force a function (e.g. event handler) to be run on the frontend.
 * 
 * The function will also be called on the frontend in standalone mode.
 * Most UIX Apis and the outer module context are not available inside the wrapped function.
 * 
 * This is the counterpart to UIX.bindToOrigin, which always ensures that
 * the module context is available inside the wrapped function.
 */
export function inDisplayContext<F extends (...args:any)=>any>(fn: F): F {
	// @ts-ignore
	fn[STANDALONE] = true;
	return fn;
}
