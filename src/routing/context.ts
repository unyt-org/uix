import { StorageMap } from "datex-core-legacy/types/storage_map.ts";
import { Datex, f } from "datex-core-legacy";
import { BROADCAST, Endpoint } from "datex-core-legacy/types/addressing.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { UIX_COOKIE, deleteCookie, getCookie } from "../session/cookies.ts";
import { getSharedDataPointer } from "../session/shared-data.ts";
import type { datex_meta } from "datex-core-legacy/utils/global_types.ts";

// TODO: remove params, use ctx.searchParams instead
export type RequestData = {address:string|null}


// persistent data
const privateData = await Datex.Storage.loadOrCreate("UIX.privateData", () => new StorageMap<Endpoint, Record<string, unknown>>())
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

	static #sessionFlags = new WeakMap<Endpoint, Map<string, any>>()

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
	endpointIsTrusted = false
	
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
			const { isSafariClient } = await import("../utils/safari.ts" /*lazy*/);

			if (!this.request) throw new Error("Cannot get shared data from UIX Context with request object");
			const url = new URL(this.request.url);
			const isSafariLocalhost = url.hostname == "localhost" && isSafariClient(this.request);
			const {sharedData} = await getSharedDataPointer(this.request.headers, this.responseHeaders, url.port, isSafariLocalhost);
			if (sharedData[Symbol.dispose]) this.#disposeCallbacks.add(sharedData[Symbol.dispose]!)
			return sharedData as CustomSharedData;
		}
	}

	/**
	 * Returns a private data record, containing arbitrary key-value pairs.
	 * This data is separated for each endpoint session and is only accessible from the backend 
	 */
	async getPrivateData(): Promise<CustomPrivateData> {
		// TODO: don't use main endpoint, only as workaround for now because of unpredicatable endpoint instance switching
		const endpoint = this.endpoint.main;
		this.validateEndpointForPrivateData(endpoint);
		if (!await privateData.has(endpoint)) {
			await privateData.set(endpoint, {})
		};
		return (await privateData.get(endpoint))! as CustomPrivateData;
	}

	/**
	 * Returns a private data record, containing arbitrary key-value pairs.
	 * If no data record exists for the endpoint session, null is returned.
	 * Use getPrivateData() to automatically create a new data record if none exists.
	 */
	async getPrivateDataWeak() {
		const endpoint = this.endpoint.main;
		this.validateEndpointForPrivateData(endpoint);
		return ((await privateData.get(endpoint)) ?? null) as CustomPrivateData|null;
	}

	/**
	 * Clears the private data for the endpoint session
	 */
	async clearPrivateData() {
		// TODO: don't use main endpoint, only as workaround for now because of unpredicatable endpoint instance switching
		const endpoint = this.endpoint.main;
		this.validateEndpointForPrivateData(endpoint);
		await privateData.delete(endpoint);
	}

	/**
	 * Throws an error if private endpoint data cannot be accessed
	 * @param endpoint 
	 */
	private validateEndpointForPrivateData(endpoint: Datex.Endpoint) {
		if (client_type == "browser") throw new Error("Private data is only accessible from the backend");
		if (endpoint == BROADCAST) throw new Error("Cannot get private data for UIX context, no session found");
	}

	/**
	 * Enables edit mode for the current session.
	 * Allows the user to edit editableTemplate content directly on the website.
	 */
	enableEditMode() {
		this.setSessionFlag("editMode");
	}
	/**
	 * Disables edit mode for the current session.
	 */
	disableEditMode() {
		this.removeSessionFlag("editMode");
	}

	/**
	 * Returns the value of a session flag if it is set.
	 * @param key session flag key
	 */
	getSessionFlag(key: string) {
		if (!this.endpoint) throw new Error("Cannot set session flag without endpoint");
		return Context.#sessionFlags.get(this.endpoint)?.get(key);
	}

	/**
	 * Sets a session flag for the current session.
	 * Important: Don't set the flag to false, use removeSessionFlag instead.
	 * @param key session flag key
	 * @param value optional session flag value, defaults: true
	 */
	setSessionFlag(key: string, value: any = true) {
		if (!this.endpoint) throw new Error("Cannot set session flag without endpoint");
		if (!Context.#sessionFlags.has(this.endpoint)) Context.#sessionFlags.set(this.endpoint, new Map());
		Context.#sessionFlags.get(this.endpoint)!.set(key, value);
	}

	/**
	 * Removes a session flag for the current session.
	 * @param key session flag key
	 */
	removeSessionFlag(key: string) {
		if (!this.endpoint) throw new Error("Cannot delete session flag without endpoint");
		Context.#sessionFlags.get(this.endpoint)?.delete(key);
	}

	[Symbol.dispose]() {
		console.log("disposing context", this.#disposeCallbacks);
		for (const dispose of this.#disposeCallbacks) dispose();
	}


	/**
	 * Gets the context-bound private data for an endpoint.
	 * 
	 * Example:
	 * ```ts
	 * const endpoint = f('@example')
	 * const privateData = Context.getPrivateData(endpoint);
	 * ```
	 */
	static async getPrivateData(endpoint: Datex.Endpoint): Promise<PrivateData>
	/**
	 * Gets the context-bound private data. This can be used inside normal functions
	 * that are called from remote endpoints but do not have access to the UIX context object.
	 * 
	 * If the calling endpoint cannot be verified, an error is thrown.
	 * 
	 * Example:
	 * ```ts
	 * // backend/functions.ts
	 * export function doBackendStuff() {
	 *    const privateData = Context.getPrivateData(datex.meta);
	 * 	  // ..
	 * }
	 * ```
	 */
	static async getPrivateData(meta: datex_meta): Promise<PrivateData>
	static async getPrivateData(endpoint_or_meta: Datex.Endpoint|datex_meta) {
		let endpoint = this.getEndpoint(endpoint_or_meta);

		// TODO: don't use main endpoint, only as workaround for now because of unpredicatable endpoint instance switching
		endpoint = endpoint.main;

		if (!await privateData.has(endpoint)) await privateData.set(endpoint, {});
		return (await privateData.get(endpoint))! as PrivateData;
	}

	/**
	 * Gets the context-bound private data for an endpoint.
	 * If no data record exists for the endpoint, null is returned.
	 */
	static async getPrivateDataWeak(endpoint: Datex.Endpoint): Promise<PrivateData|null>
	/**
	 * Gets the context-bound private data. This can be used inside normal functions
	 * that are called from remote endpoints but do not have access to the UIX context object.
	 */
	static async getPrivateDataWeak(meta: datex_meta): Promise<PrivateData|null>
	static async getPrivateDataWeak(endpoint_or_meta: Datex.Endpoint|datex_meta) {
		let endpoint = this.getEndpoint(endpoint_or_meta);
		// TODO: don't use main endpoint, only as workaround for now because of unpredicatable endpoint instance switching
		endpoint = endpoint.main;

		return ((await privateData.get(endpoint)) ?? null) as PrivateData|null;
	}

	/**
	 * Clears the private data for an endpoint.
	 * 
	 * Example:
	 * ```ts
	 * const endpoint = f('@example')
	 * Context.clearPrivateData(endpoint);
	 * ```
	 */
	static async clearPrivateData(endpoint: Datex.Endpoint): Promise<void>
	/**
	 * Clears the private data for the verified caller endpoint.
	 * 
	 * Example:
	 * ```ts
	 * // backend/functions.ts
	 * export function doBackendStuff() {
	 *    Context.clearPrivateData(datex.meta);
	 * 	  // ..
	 * }
	 * ```
	 */
	static async clearPrivateData(meta: datex_meta): Promise<void>
	static async clearPrivateData(endpoint_or_meta: Datex.Endpoint|datex_meta) {
		let endpoint = this.getEndpoint(endpoint_or_meta);

		// TODO: don't use main endpoint, only as workaround for now because of unpredicatable endpoint instance switching
		endpoint = endpoint.main;
		await privateData.delete(endpoint);
	}


	private static getEndpoint(endpoint_or_meta: Datex.Endpoint|datex_meta) {
		if (endpoint_or_meta instanceof Datex.Endpoint) return endpoint_or_meta;
		else {
			if (!endpoint_or_meta.signed || endpoint_or_meta.local) throw new Error("Cannot get private data for unverified endpoint");
			else return endpoint_or_meta.sender;
		}
	}


}

export class ContextBuilder {

	#ctx = new Context()

	public static getRequestLanguage(req:Request) {
		const port = new URL(req.url).port;
		const lang = getCookie(UIX_COOKIE.language, req.headers, port) ?? req.headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.split("-")[0];
		if (!lang || lang?.includes("*") || lang?.length !== 2) return "en";
		else return lang;
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
		this.#ctx.endpointIsTrusted = this.getEndpointIsTrusted(request)

		return this;
	}

	getEndpoint(request: Request) {
		return getHTTPRequestEndpoint(request, this.#ctx.responseHeaders)
	}

	getEndpointIsTrusted(request: Request) {
		return !!getCookie("uix-session", request.headers, new URL(request.url).port)
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
	const port = new URL(request.url).port;
	const endpointCookie = (request as any)._endpoint ?? getCookie(UIX_COOKIE.endpoint, request.headers, port);
	if (!endpointCookie) return null;
	else {
		try {
			return f(endpointCookie as any);
		}
		// invalid cookie content, reset
		catch {
			if (responseHeaders) deleteCookie(UIX_COOKIE.endpoint, responseHeaders, port)
			return null;
		}
	}
	// TODO signature validation
}

export type ContextGenerator = () => Context