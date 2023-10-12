import { Datex } from "datex-core-legacy/datex.ts";
import { UIX_COOKIE, deleteCookie, getCookie, setCookie } from "./cookies.ts";

export async function getSharedDataPointer(readHeaders?:Headers, writeHeaders?:Headers) {
	let cookieSharedData: Record<string, unknown> & {[Symbol.dispose]?:()=>void}

	const cookie = getCookie(UIX_COOKIE.sharedData, readHeaders);
	if (cookie) {

		try {
			console.debug("shared data cookie: \n" + await Datex.MessageLogger.decompile(Datex.base64ToArrayBuffer(cookie), false));
			cookieSharedData = $$(await Datex.Runtime.decodeValueBase64<Record<string, unknown>>(cookie))
		}
		catch (e) {
			cookieSharedData = $$({})
			console.log(e)
			console.error("Failed to reconstruct shared data");
			deleteCookie(UIX_COOKIE.sharedData, writeHeaders)
		}
	}
	else {
		cookieSharedData = $$({})
	}

	const update = () => {
		setCookie(UIX_COOKIE.sharedData, Datex.Compiler.encodeValueBase64({...cookieSharedData}, undefined, undefined, false, true), undefined, writeHeaders)
	};
	Datex.Ref.observe(cookieSharedData, update)

	cookieSharedData[Symbol.dispose] = () => Datex.Ref.unobserve(cookieSharedData, update)

	return cookieSharedData;
}