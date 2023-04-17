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
export function bindToOrigin<F extends (...args:any)=>any>(fn: F, context?:any): F extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<Promise<R>>> : never  {
	if (typeof fn !== "function") throw new Error("bindToOrigin: must be a function");
	
	// @ts-ignore already bound
	if (fn.uix_bound || fn.ntarget?.uix_bound) return <any>fn;

	// @ts-ignore
	if (context) fn = fn.bind(context);
	// @ts-ignore
	fn = $$(fn);
	// @ts-ignore
	const ptr:Datex.Pointer = fn[DX_PTR] ?? fn.ntarget?.[DX_PTR];
	if (!ptr) throw new Error("UIX.fn: function must be bound to a DATEX pointer");
	// prevent garbage collection
	ptr.is_persistant = true;
	return new Function('fn',`
		const proxy = function (...args) {
			// fn not defined - invalid context - use datex over http
			try {fn} catch {
				const dx = "${ptr.idString()}("+JSON.stringify(args).slice(1,-1)+")";
				return (async ()=> {
					const res = await fetch("/@uix/datex/"+encodeURIComponent(dx));
					const text = await res.text();
					if (res.ok) {
						try {return JSON.parse(text)}
						catch {return "Return value is not valid JSON"}
					}
					else throw new Error(text)
				})()
			}
			// call fn normally
			return fn(...args);
		};
		proxy.uix_bound = true;
		return proxy;
	`)(fn)
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
export function onFrontend<F extends (...args:any)=>any>(fn: F): F {
	// @ts-ignore
	fn[STANDALONE] = true;
	return fn;
}