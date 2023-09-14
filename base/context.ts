const { getCookies }  = globalThis.Deno ? await import("https://deno.land/std/http/cookie.ts") : {deleteCookie:null, setCookie:null, getCookies:null};

export type RequestData = Request & {address:string, params: () => Promise<URLSearchParams>|URLSearchParams}


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

/**
 * Context passed to callback functions in entrypoints, e,g.:
 * ```ts
 * // entrypoint.ts
 * export default (ctx: Context) => {
 *    console.log("url: " + ctx.request.url)
 * } satisfies Entrypoint
 * ```
 * The match/urlMatch property contains the values for a preceding url pattern:
 * ```ts
 * // entrypoint.ts
 * export default {
 *    '/:id/:name': (ctx: Context) => ctx.urlMatch.get('name')
 * } satisfies Entrypoint
 * ```
 */
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

		this.#ctx.request!.params = async () => {
			if (this.#ctx.request!.method == "POST") return new URLSearchParams(await this.#ctx.request!.text());
			else return new URL(this.#ctx.request!.url).searchParams
		}
		

		this.#ctx.language = ContextBuilder.getRequestLanguage(req.request);

		return this;
	}

	build() {
		return this.#ctx;
	}
}


export type ContextGenerator = () => Context