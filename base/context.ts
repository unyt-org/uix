import { Datex } from "unyt_core/datex.ts";
import { BROADCAST, Endpoint } from "unyt_core/types/addressing.ts";

const { getCookies } = globalThis.Deno ? await import("https://deno.land/std/http/cookie.ts") : {deleteCookie:null, setCookie:null, getCookies:null};

// TODO: remove params, use ctx.searchParams instead
export type RequestData = {address:string|null}


const emptyMatch = Object.freeze({});

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
	request?: Request
	requestData: RequestData = {
		address: null
	}

	path!: string
	params: Record<string,string> = emptyMatch;
	searchParams!: URLSearchParams

	language = "en";
	endpoint = BROADCAST

	async getSharedData(): Promise<Record<string, any>|null> {
		if (!this.request) return null;
		const cookie = getCookies?.(this.request?.headers)?.['uix-shared-data'];
		if (!cookie) return null;
		const cookieSharedData = await Datex.Runtime.decodeValueBase64(decodeURIComponent(cookie))
		return cookieSharedData
	}
	getPrivateData(): Record<string, any> {

	}
}

export class ContextBuilder {

	#ctx = new Context()

	public static getRequestLanguage(req:Request) {
		return getCookies?.(req.headers)?.['uix-language'] ?? req.headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.split("-")[0] ?? "en"
	}

	async setRequestData(req:Deno.RequestEvent, path:string, con:Deno.Conn) {
		this.#ctx.request = req.request
		this.#ctx.requestData.address = req.request.headers?.get("x-real-ip") ??
					req.request.headers?.get("x-forwarded-for") ?? 
					(con.remoteAddr as Deno.NetAddr)?.hostname
		
		this.#ctx.path = path;
		// Object.assign(this.#ctx.request!, req.request)
		// // @ts-ignore headers copied from prototype?
		// this.#ctx.request!.headers = req.request.headers;
		// this.#ctx.request!.url = req.request.url;

		// this.#ctx.request!.localAddr = con.localAddr

		const isPost = this.#ctx.request!.method == "POST";
		const postRequestBody = isPost ? await this.#ctx.request!.text() : null;

		const ctx = this.#ctx;

		Object.defineProperty(this.#ctx, "searchParams", {
			get() {
				if (isPost) return new URLSearchParams(postRequestBody!);
				else return new URL(ctx.request!.url).searchParams
			},
		})
	

		this.#ctx.language = ContextBuilder.getRequestLanguage(req.request);

		return this;
	}

	build() {
		return this.#ctx;
	}
}


export type ContextGenerator = () => Promise<Context>