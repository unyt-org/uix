import { Datex } from "datex-core-legacy/mod.ts";
import { Context } from "../routing/context.ts";
import { provideJSON } from "../html/entrypoint-providers.tsx";
import { HTTPStatus } from "../html/http-status.ts";
import { Entrypoint } from "../html/entrypoints.ts";
import { StructuralTypeDefIn, collapseTypeDef } from "datex-core-legacy/types/struct.ts"

/**
 * Handles an HTTP request with a JSON request body that gets validated against a provided type.
 * @param requestType the type of the request body
 * @param requestHandler receives the request body as a typed object, the context and the request arguments and returns the response as a JSON value
 * @param errorMapping an optional function that receives an error that was thrown during validation or in the request handler and returns a custom JSON error value with an optional HTTP status code
 */
export function handleTypedRequest<T extends Datex.Type|StructuralTypeDefIn|null>(requestType: T, requestHandler: (value: T extends Datex.Type ? Datex.inferDatexType<T> : (T extends StructuralTypeDefIn ? collapseTypeDef<T> : null), ctx: Context, args: Record<string,string>) => unknown|Promise<unknown>, errorMapping?: (e:unknown, ctx: Context, args: Record<string,string>) => [unknown, HTTPStatus?]|Promise<[unknown, HTTPStatus?]>) {
	return (async (ctx: Context, args: Record<string,string>) => {

		let normalizedRequestType: Datex.Type|null = null;

		if (requestType instanceof Datex.Type) normalizedRequestType = requestType;
		else if (requestType !== null) normalizedRequestType = struct(requestType) as any;

		try {
			const data = normalizedRequestType ? await ctx.request.json() : null;
			const requestValue = normalizedRequestType ? normalizedRequestType.new(data) : null;
			const result = await requestHandler(requestValue, ctx, args);

			// passthrough for non-JSON values like Response/URL
			if (result instanceof Response) return result;
			if (result instanceof URL) return result;

			return await provideJSON(result);
		}
		catch (e) {
			if (errorMapping) {
				const [error, status] = await errorMapping(e, ctx, args);
				try {
					return (status??HTTPStatus.BAD_REQUEST).with(await provideJSON(error))
				}
				catch {
					return HTTPStatus.BAD_REQUEST.with(
						await provideJSON({error: "Unknown error"})
					)
				}
			}
			else if (e instanceof Response || e instanceof HTTPStatus) throw e;
			else {
				return HTTPStatus.BAD_REQUEST.with(
					await provideJSON({error: e instanceof Error ? e.message : e?.toString() || "Request error"})
				)
			}
		}
	}) satisfies Entrypoint;
}