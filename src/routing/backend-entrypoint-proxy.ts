import { domContext } from "../app/dom-context.ts";
import { Entrypoint } from "../html/entrypoints.ts";
import { RenderMethod } from "../base/render-methods.ts";
import { hydrationCache } from "../hydration/hydration-cache.ts";
import { PartialHydration } from "../hydration/partial-hydration.ts";
import { Element } from "../uix-dom/dom/mod.ts";
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

		let render_method = RenderMethod.HYBRID;
		let content = undefined;

		// get from hydration cache
		if ((ctx as any)._hydrationPtr) {
			content = hydrationCache.get((ctx as any)._hydrationPtr)
			// logger.info("hydcache", content)
		}

		// resolve entrypoint
		else ({ content, render_method } = await resolveEntrypointRoute({entrypoint, route: Path.Route(ctx.path)}));
		
		// partial hydration, only return live nodes
		if (render_method == RenderMethod.HYBRID && content instanceof domContext.Element) {
			return new PartialHydration(content as Element);
		}
		
		return content;
	}
}