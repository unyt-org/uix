import { StorageMap } from "unyt_core/types/storage_map.ts";
import { Datex, f } from "unyt_core/datex.ts";
import { BROADCAST, Endpoint } from "unyt_core/types/addressing.ts";
import { client_type } from "unyt_core/utils/constants.ts";
import { UIX_COOKIE, getCookie } from "../session/cookies.ts";
import { getSharedDataPointer } from "../session/shared-data.ts";

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

// @ts-ignore
Symbol.dispose ??= Symbol.for("Symbol.dispose")


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

	get responseHeaders() {
		if (!this._responseHeaders) this._responseHeaders = new Headers();
		return this._responseHeaders
	}


	private _responseHeaders?: Headers

	#disposeCallbacks = new Set<()=>void>()

	async getPostParams() {
		if (this.request!.method !== "POST") throw new Error("Not a POST request");
		return new URLSearchParams(await this.request!.text()!);
	}

	/**
	 * Returns a shared data record, containing arbitrary key-value pairs.
	 * This data is separated for each endpoint session and is accessible from the client and the backend 
	 */
	async getSharedData(): Promise<Record<string, unknown>> {
		if (client_type === "browser") {
			const { getSharedData } = await import("../session/frontend.ts");
			return getSharedData();
		}
		else {
			if (!this.request) throw new Error("Cannot get shared data from UIX Context with request object");
			const sharedData = await getSharedDataPointer(this.request.headers, this.responseHeaders);
			if (sharedData[Symbol.dispose]) this.#disposeCallbacks.add(sharedData[Symbol.dispose]!)
			return sharedData;
		}
	}

	/**
	 * Returns a private data record, containing arbitrary key-value pairs.
	 * This data is separated for each endpoint session and is only accessible from the backend 
	 */
	async getPrivateData(): Promise<Record<string, unknown>> {
		if (client_type == "browser") throw new Error("Private data is only accessible from the backend");
		if (this.endpoint == BROADCAST) throw new Error("Cannot get private data for UIX context, no session found");
		console.log("get private data for " + this.endpoint);
		if (!privateData.has(this.endpoint)) await privateData.set(this.endpoint, {});
		return (await privateData.get(this.endpoint))!;
	}

	[Symbol.dispose]() {
		console.log("disposing context", this.#disposeCallbacks);
		for (const dispose of this.#disposeCallbacks) dispose();
	}
}

export class ContextBuilder {

	#ctx = new Context()

	public static getRequestLanguage(req:Request) {
		return getCookie(UIX_COOKIE.language, req.headers) ?? req.headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.split("-")[0] ?? "en"
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
		const endpointCookie = getCookie(UIX_COOKIE.endpoint, request.headers);
		if (!endpointCookie) return null;
		else return f(endpointCookie as any);
		// TODO signature validation
	}

	build() {
		return this.#ctx;
	}
}


export type ContextGenerator = () => Context