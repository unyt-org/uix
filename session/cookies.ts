export const cookie = {
	endpoint: "uix-endpoint",
	language: "uix-language",
	sharedData: "uix-shared-data"
} as const;
export type cookie = typeof cookie[keyof typeof cookie];



export function deleteCookie(name: cookie) {   
    document.cookie = name+'=; Max-Age=-99999999;';  
}

export function setCookie(name: cookie, value:string, expDays?:number) {
	let expires = "";
	if (expDays) {
		const date = new Date();
		date.setTime(date.getTime() + (expDays * 24 * 60 * 60 * 1000));
		expires = "expires=" + date.toUTCString() + ";";
	}
	else expires = "expires=Fri, 31 Dec 9999 21:10:10 GMT;";
	document.cookie = name + "=" + value + "; " + expires + " path=/";
}

export function getCookie(name: cookie) {
	const cname = name + "=";
	const cookies = decodeURIComponent(document.cookie);
	const cookieArray = cookies.split('; ');
	let res: string|undefined;
	cookieArray.forEach(val => {
		if (val.indexOf(cname) === 0) res = val.substring(cname.length);
	})
	return res;
}