import { Datex } from "unyt_core/datex.ts";
import { cookie, deleteCookie, getCookie, setCookie } from "./cookies.ts";


export async function initSession() {

	Datex.Runtime.onEndpointChanged(()=>{
		const endpointName = Datex.Runtime.endpoint.toString();
		if (getCookie(cookie.endpoint) !== endpointName)
			setCookie(cookie.endpoint, Datex.Runtime.endpoint.toString());
	})

	if ((globalThis as any).cookieStore) {
		((globalThis as any).cookieStore).addEventListener('change', ({changed}: {changed:any}) => {
			for (const {name, value} of changed) {
				if (name == cookie.sharedData) {
					console.debug("shared data cookie was updated")
				}
			}
		});
	}
	
}

export const sharedData:Record<string,unknown>|undefined = await lazyEternalVar("sharedData") ?? $$({}) as unknown as Record<string,unknown>;

const sharedDataCookie = getCookie(cookie.sharedData);
if (sharedDataCookie) {
	let cookieSharedData: any;
	try {
		cookieSharedData = await Datex.Runtime.decodeValueBase64(decodeURIComponent(sharedDataCookie))
	}
	catch (e) {
		console.log(e)
		console.error("Failed to reconstruct shared data");
		deleteCookie(cookie.sharedData)
	}
	if (!await Datex.Runtime.equalValues(sharedData, cookieSharedData)) {
		console.error("shared data difference", [sharedData, cookieSharedData])
	}
}
Datex.Ref.observe(sharedData, () => saveSharedData())


function saveSharedData() {
	setCookie(cookie.sharedData, encodeURIComponent(Datex.Compiler.encodeValueBase64(sharedData, undefined, false, false, true)))
}