import { createStaticObject } from "./create-static-object.ts";

/**
 * Call a remote function.
 * Falls back to DATEX over HTTP if DATEX Runtime not available,
 * otherwise, function is called over DATEX
 * @param ptrId pointer id of the function
 * @param args function arguments
 */
export async function callCompat(ptrId: string, args: unknown[]) {
	// use datex
	if ((globalThis as any).datex && (globalThis as any).Datex && (globalThis as any).Datex.Runtime.initialized) {
		await (globalThis as any).Datex.Supranet.connect();
		return datex(`${ptrId}(Tuple(?))`, [args]);
	}
	// use datex-over-http
	else {
		const dx = ptrId + "("+JSON.stringify(args).slice(1,-1)+")";
		const res = await fetch("/@uix/datex/"+encodeURIComponent(dx));
		const text = await res.text();
		if (res.ok) {
			try {
				return createStaticObject(JSON.parse(text));
			}
			catch {return "Return value is not valid JSON"}
		}
		else throw new Error(text)
	}
}

/**
 * Call a remote function via DATEX (force loading unyt_core if not initialized)
 * @param ptrId pointer id of the function
 * @param args function arguments
 * @returns 
 */
export async function callDatex(ptrId: string, args: unknown[]) {
	const {Datex} = await import("datex-core-legacy");
	await Datex.Supranet.connect();
	return datex(`${ptrId}(Tuple(?))`, [args]);
}