import { Entrypoint } from "../html/entrypoints.ts";
import { logger } from "../utils/global-values.ts";
import { Path } from "../utils/path.ts";
import { Context } from "./context.ts";
import { resolveEntrypointRoute } from "./rendering.ts";

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
export function createBackendEntrypointProxy(entrypoint: Entrypoint) {
	return async function(ctx: Context, _params:Record<string,string>) {

		// resolve entrypoint
		const { content, render_method } = await resolveEntrypointRoute({entrypoint, route: Path.Route(ctx.path)});
				
		return content;
	}
}