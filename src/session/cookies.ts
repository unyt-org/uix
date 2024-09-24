import { getCookies as getHeaderCookies, setCookie as setHeaderCookie } from "../lib/cookie/cookie.ts";

// @ts-ignore
// from "datex-core-legacy/utils/constants.ts"
const is_worker = (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope);
export const client_type = is_worker ? 'worker' : ("Deno" in globalThis && !(globalThis.Deno as any).isPolyfill ? 'deno' : 'browser')

const portPrefix = client_type == "browser" ? globalThis.location.port : undefined;

export const UIX_COOKIE = {
	endpoint: "datex-endpoint",
	endpointValidation: "datex-endpoint-validation",
	endpointNonce: "datex-endpoint-nonce",

	session: "uix-session",
	unverifiedSession: "uix-session-unverified",
	language: "uix-language",
	themeDark: "uix-theme-dark",
	themeLight: "uix-theme-light",
	colorMode: "uix-color-mode",
	initialColorMode: "uix-initial-color-mode",
	sharedData: "uix-shared-data"
} as const;
export type UIX_COOKIE = typeof UIX_COOKIE[keyof typeof UIX_COOKIE];

const browserIsSafariLocalhost = globalThis.location?.hostname == "localhost" && (/^((?!chrome|android).)*safari/i.test(navigator.userAgent));

export function deleteCookie(name: UIX_COOKIE | string, headers?: Headers, port?:string, isSafariLocalhost = false) {

	port ??= portPrefix
	if (port) name += "/" + port;

	if (headers) {
		setHeaderCookie!(headers, {
			name,
			value: "",
			sameSite: "None",
			secure: !isSafariLocalhost,
			path: '/',
			expires: new Date(0)
		})
	}
    else document.cookie = name +'=; Path=/; SameSite=None; Expires=Thu, 01 Jan 1970 00:00:01 GMT;' + (browserIsSafariLocalhost ? "" :" Secure;")
}

export function setCookie(name: UIX_COOKIE | string, value:string, expDays?:number, headers?: Headers, port?:string, isSafariLocalhost = false) {

	port ??= portPrefix
	if (port) name += "/" + port;

	value = encodeURIComponent(value)

	let expiryDate = new Date("Fri, 31 Dec 9999 21:10:10 GMT");
	if (expDays) {
		expiryDate = new Date();
		expiryDate.setTime(expiryDate.getTime() + (expDays * 24 * 60 * 60 * 1000));
	}

	if (headers) {
		setHeaderCookie!(headers, {
			name,
			value,
			sameSite: "None",
			secure: !isSafariLocalhost,
			path: '/',
			expires: expiryDate
		})
	}

	else {
		const expires = "expires=" + expiryDate.toUTCString() + ";";
		// SameSite none leads to errors (in combination with Secure/Not secure)
		document.cookie = name + "=" + value + "; " + expires + " path=/; SameSite=None;" + (browserIsSafariLocalhost ? "" :" Secure;")
	}
	
}

export function getCookie(name: UIX_COOKIE | string, headers?: Headers, port?:string) {

	port ??= portPrefix
	if (port) name += "/" + port;

	if (headers) {
		const cookie = getHeaderCookies!(headers)?.[name];
		return cookie ? decodeURIComponent(cookie) : null;
	}

	else {
		const cname = name + "=";
		const cookies = decodeURIComponent(document.cookie);
		const cookieArray = cookies.split('; ');
		let res: string|undefined;
		cookieArray.forEach(val => {
			if (val.indexOf(cname) === 0) res = val.substring(cname.length);
		})
		return res;
	}
}