import { Datex } from "datex-core-legacy/mod.ts";
import { RenderMethod, RenderPreset } from "../base/render-methods.ts";
import { Entrypoint } from "../html/entrypoints.ts";
import { logger } from "../utils/global-values.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { Context, ContextBuilder } from "./context.ts";
import { resolveEntrypointRoute } from "./rendering.ts";
import { getRandomString } from "datex-core-legacy/utils/utils.ts";
import { HTTPStatus } from "../html/http-status.ts";

/**
 * Creates an entrypoint proxy function
 * that can be exposed as the endpoint #entrypoint
 * and can be used to request routes from the frontend
 * 
 * Automatically applies partial hydration.
 * 
 * @param entrypoint 
 * @returns 
 */
// SECURITY: headers that are set by the reverse proxy / server and must not be supplied by the caller
const PROXY_REQUEST_FORBIDDEN_HEADERS = ["x-real-ip", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "forwarded", "cookie"];

/**
 * Removes headers from a caller supplied request that could be used to spoof the client address or session
 */
function sanitizeProxyRequest(request: unknown) {
	if (!(request instanceof Request)) return request as Request;
	const headers = new Headers(request.headers);
	for (const name of PROXY_REQUEST_FORBIDDEN_HEADERS) headers.delete(name);
	return new Request(request, { headers });
}

export function createBackendEntrypointProxy(entrypoint: Entrypoint) {
	const fn = $$(async function(_ctx: Context, _params:Record<string,string>) {

		// SECURITY: the context (session, private data) is bound to the caller endpoint,
		// unsigned sender information can be spoofed, so only verified callers are accepted
		const meta = datex.meta;
		if (!meta.signed && !meta.local) {
			throw new Error("Entrypoint requests are only allowed from verified endpoints");
		}

		// set endpoint from datex meta
		const path = Path.Route(_ctx.path);
		const ctx = new ContextBuilder()
			.setRequestData(sanitizeProxyRequest(_ctx.request), _ctx.path)
			.build();
		
		ctx.endpoint = meta.caller;
		if (meta.signed) ctx.endpointIsTrusted = true;

		// resolve entrypoint
		const { content, render_method, status_code } = await resolveEntrypointRoute({entrypoint, context: ctx, route: path});
		
		// cache response
		if (content instanceof Response) {
			
			// supported content types for frontend response handling
			let supportsFrontendReloading = false;
			if (content.headers.get("content-type")?.startsWith("text/plain")) supportsFrontendReloading = true;

			const token = getRandomString();
			cachedResponses.set(token, content);
			// delete after 30s
			setTimeout(()=>cachedResponses.delete(token), 30000);

			// return response with token
			return new RenderPreset(
				supportsFrontendReloading ? RenderMethod.CACHED_RESPONSE : RenderMethod.STATIC,
				supportsFrontendReloading ? token : new HTTPStatus(302, token), 
				status_code
			);
		}

		return new RenderPreset(render_method, content, status_code);
	})

	Datex.Pointer.getByValue(fn)!.grantPublicAccess(true)

	return fn;
}

const cachedResponses = new Map<string, Response>();

export function getCachedResponse(token: string) {
	const response = cachedResponses.get(token);
	if (response) cachedResponses.delete(token);
	return response;
}