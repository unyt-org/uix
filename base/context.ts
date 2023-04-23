const { deleteCookie, setCookie, getCookies }  = globalThis.Deno ? await import("https://deno.land/std/http/cookie.ts") : {deleteCookie:null, setCookie:null, getCookies:null};

export type RequestData = Request & {address:string}


export class URLMatch {
	constructor(public matches: URLPatternResult) {}

	public get(identifier:string|number):string|null {
		if (!this.matches) return null;
		for (const group of Object.values(this.matches)) {
			if (group.groups?.[identifier] != undefined) return group.groups[identifier];
		}
		return null;
	}
}

const emptyMatch = new URLMatch({} as URLPatternResult);


export class Context {
	request?: RequestData
	path!: string
	match?: URLPatternResult
	urlMatch: URLMatch = emptyMatch;
	language = "en";
}

export class ContextBuilder {

	#ctx = new Context()

	public static getRequestLanguage(req:Request) {
		return getCookies?.(req.headers)?.['uix-language'] ?? req.headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.split("-")[0] ?? "en"
	}

	setRequestData(req:Deno.RequestEvent, path:string, con:Deno.Conn) {
		this.#ctx.request = <RequestData> req.request//<any>{}
		this.#ctx.path = path;
		// Object.assign(this.#ctx.request!, req.request)
		// // @ts-ignore headers copied from prototype?
		// this.#ctx.request!.headers = req.request.headers;
		// this.#ctx.request!.url = req.request.url;

		// this.#ctx.request!.localAddr = con.localAddr
		this.#ctx.request!.address = req.request.headers?.get("x-real-ip") ??
				req.request.headers?.get("x-forwarded-for") ?? 
				(con.remoteAddr as Deno.NetAddr)?.hostname;
		// TODO: remove
		this.#ctx.request!.path = path;

		this.#ctx.language = ContextBuilder.getRequestLanguage(req.request);

		return this;
	}

	build() {
		return this.#ctx;
	}
}


export type ContextGenerator = ()=>Context