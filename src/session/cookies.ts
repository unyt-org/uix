import { getCookies as getHeaderCookies, setCookie as setHeaderCookie, deleteCookie as deleteHeaderCookie } from "../lib/cookie/cookie.ts";

export const UIX_COOKIE = {
	endpoint: "uix-endpoint",
	language: "uix-language",
	theme: "uix-theme",
	colorMode: "uix-color-mode",
	sharedData: "uix-shared-data"
} as const;
export type UIX_COOKIE = typeof UIX_COOKIE[keyof typeof UIX_COOKIE];



export function deleteCookie(name: UIX_COOKIE | string, headers?: Headers) {
	if (headers) deleteHeaderCookie!(headers, name)
    else document.cookie = name+'=; Max-Age=-99999999;';  
}

export function setCookie(name: UIX_COOKIE | string, value:string, expDays?:number, headers?: Headers) {

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
			path: '/',
			expires: expiryDate
		})
	}

	else {
		const expires = "expires=" + expiryDate.toUTCString() + ";";
		document.cookie = name + "=" + value + "; " + expires + " path=/; SameSite=None; Secure;";
	}
	
}

export function getCookie(name: UIX_COOKIE | string, headers?: Headers) {

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