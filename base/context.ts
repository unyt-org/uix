import { StorageMap } from "unyt_core/types/storage_map.ts";
import { Datex, f } from "unyt_core/datex.ts";
import { BROADCAST, Endpoint } from "unyt_core/types/addressing.ts";

const { getCookies } = globalThis.Deno ? await import("https://deno.land/std/http/cookie.ts") : {deleteCookie:null, setCookie:null, getCookies:null};

// TODO: remove params, use ctx.searchParams instead
export type RequestData = {address:string|null}


// persistant data
// TODO: fix and use StorageMap
const privateData = await lazyEternalVar("privateData") ?? $$(new Map<Endpoint, Record<string, unknown>>)

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
	urlPattern?: URLPatternResult
	searchParams!: URLSearchParams

	language = "en";
	endpoint: Datex.Endpoint = BROADCAST

	async getPostParams() {
		if (this.request!.method !== "POST") throw new Error("Not a POST request");
		return new URLSearchParams(await this.request!.text()!);
	}

	async getSharedData(): Promise<Record<string, unknown>|null> {
		if (!this.request) return null;
		const cookie = getCookies?.(this.request?.headers)?.['uix-shared-data'];
		if (!cookie) return null;
		const cookieSharedData = await Datex.Runtime.decodeValueBase64<Record<string, unknown>|null>(decodeURIComponent(cookie))
		return cookieSharedData
	}
	async getPrivateData(): Promise<Record<string, unknown>> {
		if (this.endpoint == BROADCAST) throw new Error("Cannot get private data for UIX context, no session found");
		console.log("get private data for " + this.endpoint);
		if (!privateData.has(this.endpoint)) await privateData.set(this.endpoint, {});
		return (await privateData.get(this.endpoint))!;
	}
}

export class ContextBuilder {

	#ctx = new Context()

	public static getRequestLanguage(req:Request) {
		return getCookies?.(req.headers)?.['uix-language'] ?? req.headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.split("-")[0] ?? "en"
	}

	setRequestData(req:Deno.RequestEvent, path:string, conn?:Deno.Conn) {
		this.#ctx.request = req.request
		this.#ctx.requestData.address = req.request.headers?.get("x-real-ip") ??
					req.request.headers?.get("x-forwarded-for") ?? 
					(conn?.remoteAddr as Deno.NetAddr)?.hostname
		
		this.#ctx.path = path;

		const ctx = this.#ctx;

		Object.defineProperty(this.#ctx, "searchParams", {
			get() {
				return new URL(ctx.request!.url).searchParams
			},
		})
	

		this.#ctx.language = ContextBuilder.getRequestLanguage(req.request);
		this.#ctx.endpoint = this.getEndpoint(req.request) ?? BROADCAST;

		return this;
	}

	getEndpoint(request: Request) {
		if (!request) return null;
		const endpointCookie = getCookies?.(request.headers)?.['uix-endpoint'];
		if (!endpointCookie) return null;
		else return f(endpointCookie as any);
		// TODO signature validation
	}

	build() {
		return this.#ctx;
	}
}


export type ContextGenerator = () => Context