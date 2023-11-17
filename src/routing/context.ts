import { StorageMap } from "datex-core-legacy/types/storage_map.ts";
import { Datex, f, template } from "datex-core-legacy";
import { BROADCAST, Endpoint } from "datex-core-legacy/types/addressing.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { UIX_COOKIE, deleteCookie, getCookie } from "../session/cookies.ts";
import { getSharedDataPointer } from "../session/shared-data.ts";

// TODO: remove params, use ctx.searchParams instead
export type RequestData = {address:string|null}


// persistent data
const privateData = await Datex.Storage.loadOrCreate("UIX.privateData", () => $$(new StorageMap<Endpoint, Record<string, unknown>>()))
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


// @template("uix:Context")
export class Context
	<
		CustomSharedData extends Record<string, unknown>|SharedData = SharedData,
		CustomPrivateData extends Record<any, unknown>|PrivateData = PrivateData
	> 
{

	request: Request
	requestData: RequestData = {
		address: null
	}

	path!: string
	params: Record<string,string> = emptyMatch;
	urlPattern?: URLPatternResult
	searchParams!: URLSearchParams

	language = "en";
	endpoint: Datex.Endpoint = client_type == "browser" ? Datex.Runtime.endpoint : BROADCAST

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
	async getSharedData(): Promise<CustomSharedData> {
		if (client_type === "browser") {
			const { getSharedData } = await import("../session/frontend.ts");
			return getSharedData() as Promise<CustomSharedData>;
		}
		else {
			if (!this.request) throw new Error("Cannot get shared data from UIX Context with request object");
			const {sharedData} = await getSharedDataPointer(this.request.headers, this.responseHeaders);
			if (sharedData[Symbol.dispose]) this.#disposeCallbacks.add(sharedData[Symbol.dispose]!)
			return sharedData as CustomSharedData;
		}
	}

	/**
	 * Returns a private data record, containing arbitrary key-value pairs.
	 * This data is separated for each endpoint session and is only accessible from the backend 
	 */
	async getPrivateData(): Promise<CustomPrivateData> {
		if (client_type == "browser") throw new Error("Private data is only accessible from the backend");
		if (this.endpoint == BROADCAST) throw new Error("Cannot get private data for UIX context, no session found");
		if (!await privateData.has(this.endpoint)) await privateData.set(this.endpoint, {});
		return (await privateData.get(this.endpoint))! as CustomPrivateData;
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

	setRequestData(request:Request, path:string, conn?:Deno.Conn) {
		this.#ctx.request = request
		this.#ctx.requestData.address = request.headers?.get("x-real-ip") ??
					request.headers?.get("x-forwarded-for") ?? 
					(conn?.remoteAddr as Deno.NetAddr)?.hostname
		
		this.#ctx.path = path;

		const ctx = this.#ctx;

		Object.defineProperty(this.#ctx, "searchParams", {
			get() {
				return new URL(ctx.request!.url).searchParams
			},
		})
	
		this.#ctx.language = ContextBuilder.getRequestLanguage(request);
		this.#ctx.endpoint = this.getEndpoint(request) ?? BROADCAST;

		return this;
	}

	getEndpoint(request: Request) {
		return getHTTPRequestEndpoint(request, this.#ctx.responseHeaders)
	}

	build() {
		return this.#ctx;
	}

}

/**
 * Returns the (validated) endpoint from which a HTTP request was sent
 * @param request 
 * @param responseHeaders optional response headers that are modified if cookies are deleted in case of invalid cookie data
 * @returns 
 */
export function getHTTPRequestEndpoint(request: Request, responseHeaders?: Headers) {
	if (!request) return null;
	const endpointCookie = getCookie(UIX_COOKIE.endpoint, request.headers);
	if (!endpointCookie) return null;
	else {
		try {
			return f(endpointCookie as any);
		}
		// invalid cookie content, reset
		catch {
			if (responseHeaders) deleteCookie(UIX_COOKIE.endpoint, responseHeaders)
			return null;
		}
	}
	// TODO signature validation
}

export type ContextGenerator = () => Context