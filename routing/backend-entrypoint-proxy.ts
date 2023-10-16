import { domContext } from "../app/dom-context.ts";
import { Entrypoint } from "../html/entrypoints.ts";
import { RenderMethod } from "../html/render-methods.ts";
import { PartialHydration } from "../hydration/partial-hydration.ts";
import { Element } from "../uix-dom/dom/mod.ts";
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
		const { content, render_method } = await resolveEntrypointRoute({entrypoint, route: Path.Route(ctx.path)});
		
		// partial hydration, only return live nodes
		if (render_method == RenderMethod.HYDRATION && content instanceof domContext.Element) {
			return new PartialHydration(content as Element);
		}
		
		return content;
	}
}