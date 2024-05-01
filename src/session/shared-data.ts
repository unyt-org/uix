import { Datex } from "datex-core-legacy";
import { UIX_COOKIE, deleteCookie, getCookie, setCookie } from "./cookies.ts";

// @ts-ignore
Symbol.dispose ??= Symbol.for("Symbol.dispose")

export async function getSharedDataPointer(readHeaders?:Headers, writeHeaders?:Headers, port?: string, isSafariLocalhost = false) {
	let cookieSharedData: Record<string, unknown> & {[Symbol.dispose]?:()=>void}

	const cookie = getCookie(UIX_COOKIE.sharedData, readHeaders, port);
	if (cookie) {

		try {
			// {__proto__:{}}
			console.debug("shared data cookie: \n" + await Datex.MessageLogger.decompile(Datex.base64ToArrayBuffer(cookie), false));
			cookieSharedData = $$({__proto__:{}, ...await Datex.Runtime.decodeValueBase64<Record<string, unknown>>(cookie)})
		}
		catch (e) {
			cookieSharedData = $$({__proto__:{}})
			console.log(e)
			console.error("Failed to reconstruct shared data");
			deleteCookie(UIX_COOKIE.sharedData, writeHeaders, port, isSafariLocalhost)
		}
	}
	else {
		cookieSharedData = $$({__proto__:{}})
	}

	cookieSharedData[Symbol.dispose] = () => Datex.Ref.unobserve(cookieSharedData, update)
	const update = async () => {
		console.debug("updating shared data cookie: \n" + Datex.Runtime.valueToDatexStringExperimental({...cookieSharedData}, true, true));
		setCookie(UIX_COOKIE.sharedData, await Datex.Compiler.encodeValueBase64Async({...cookieSharedData}, undefined, undefined, false, true), undefined, writeHeaders, port, isSafariLocalhost)
	};
	Datex.Ref.observe(cookieSharedData, update)

	return {sharedData:cookieSharedData, update};
}