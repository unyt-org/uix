import { Entrypoint } from "../html/entrypoints.ts";
import { Path } from "../utils/path.ts";
import { ContextBuilder } from "./context.ts";
import { resolveEntrypointRoute } from "./rendering.ts";


export class FrontendRouter {

	#frontendEntrypoint: Entrypoint;
	#backendEntrypoint: Entrypoint;
	#isHydrating?: boolean;
	#mergeFrontend: 'override'|'insert'|undefined;

	#currentContent: unknown;
	
	setEntrypoints(frontend?: Entrypoint, backend?: Entrypoint, isHydrating = false, mergeFrontend: 'override'|'insert'|undefined = 'insert') {
		this.#frontendEntrypoint = frontend;
		this.#backendEntrypoint = backend;
		this.#isHydrating = isHydrating;
		this.#mergeFrontend = mergeFrontend;

		this.render();
	}

	async render(route: string|URL = location.href) {
		console.log("rendering", route);
		const content = await this.getContentFromEntrypoint(this.#frontendEntrypoint, route);

		if (content == this.#currentContent) {
			console.log("content is the same, skipping");
			return;
		}

		this.#currentContent = content;
		this.displayContent(content);
	}

	async displayContent(content: unknown) {
		console.log("displayContent", content);

		// TODO
	}

	async getContentFromEntrypoint(entrypoint: Entrypoint, route: URL|string, probe_no_side_effects = false) {

		route = route instanceof URL ? route : new Path(route, window.location.origin);

		// create new context with fake request
		const url = new Path(route, window.location.origin);
		const path = route.pathname;
		const context = new ContextBuilder()
			.setRequestData(new Request(url), path)
			.build()
		context.path = path;
		context.request = new Request(url)

		const { content } = await resolveEntrypointRoute({entrypoint, context, route, probe_no_side_effects});
		return content;
	}

}

export const frontendRouter = new FrontendRouter();
globalThis.frontendRouter = frontendRouter;