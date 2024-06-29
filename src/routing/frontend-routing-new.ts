import { Logger } from "datex-core-legacy/utils/logger.ts";
import { Entrypoint } from "../html/entrypoints.ts";
import { Path } from "../utils/path.ts";
import { ContextBuilder } from "./context.ts";
import { resolveEntrypointRoute } from "./rendering.ts";
import { domUtils } from "../app/dom-context.ts";
import { querySelector } from "../uix-dom/dom/shadow_dom_selector.ts";
import { Datex } from "datex-core-legacy/mod.ts";
import { PartialHydration } from "../hydration/partial-hydration.ts";
import { displayError } from "../html/errors.tsx";

const logger = new Logger("frontend router");

type MergeStrategy = 'override'|'insert'

export class FrontendRouter {

	#frontendEntrypoint: Entrypoint;
	#backendEntrypoint: Entrypoint;

	#currentContent: unknown;
	
	setEntrypoints(frontend?: Entrypoint, backend?: Entrypoint, isHydrating = false, mergeStrategy: MergeStrategy = 'override') {
		this.#frontendEntrypoint = frontend;
		this.#backendEntrypoint = backend;

		this.renderRouteContent(isHydrating, mergeStrategy);
	}

	navigateTo(route: string|URL) {
		const routePath = new Path(route, window.location.origin);
		if (new Path(location.href).toString() === routePath.toString()) {
			logger.info("already on route " + route + ", skipping navigation");
			return;
		}

		// update current tab url
		history.pushState(null, "", routePath.routename);
		// render content
		this.renderRouteContent(false, 'override', route);
	}

	async renderRouteContent(isHydrating: boolean, mergeStrategy: MergeStrategy = 'override', route: string|URL = location.href) {

		// has backend content?
		const hasBackendRenderedContent = isHydrating;

		// no backend content, just render frontend content
		if (!hasBackendRenderedContent) mergeStrategy = 'override';

		const content = await this.getContentFromEntrypoint(this.#frontendEntrypoint, route);

		if (content == this.#currentContent) {
			logger.info("content for " + route + " is the same, skipping");
			return;
		}

		logger.success("navigating to " + route);

		this.#currentContent = content;

		if (mergeStrategy == 'override') this.displayContent(content);
		else if (mergeStrategy == 'insert') this.mergeContent(content);
		else throw new Error("Invalid merge strategy: " + mergeStrategy);
	}

	displayContent(content: unknown) {
		console.log("displayContent", content);

		if (content == null) return;

		// partial hydration, no need to set new dom nodes 
		else if (content instanceof PartialHydration) {
			return;
		}

		else if (content instanceof Array) {
			document.body.innerHTML = "";
			domUtils.append(document.body, content) // add to document
		}
		// handle response
		else if (content instanceof Response) {
			this.renderResponse(content)
		}

		// TODO: currently only displayed if type not correctly mapped (TypedValue fallback)
		else if (!(content instanceof Datex.TypedValue)) { //if (content instanceof Element || content instanceof DocumentFragment) {
			document.body.innerHTML = "";
			// TODO: handle all content correctly (same behaviour as on backend)
			domUtils.append(document.body, content as any) // add to document
		}
		else {
			displayError("UIX Rendering Error", "Cannot render value of type " + Datex.Type.ofValue(content));
		}

		// TODO
	}

	/**
	 * Render a Response on the client side
	 * @param response 
	 */
	async renderResponse(response: Response) {
		if (response.body instanceof ReadableStream) {
			// if (isContentType(response, "text/html")) {
			// 	if (response.redirected) setCurrentRoute(response.url, true);
			// 	try {
			// 		const text = await response.text();
			// 		document.clear()
			// 		document.write(text);
			// 	}
			// 	catch (e) {
			// 		console.error(e)
			// 	}
			// 	// important: insert global style sheet urls from already loaded component classes again
			// 	await recreateGlobalStyleSheetLinks()
			// 	recreatePersistentListeners()
			// 	document.close();
			// }
			// else 
			if (this.isContentType(response, "text/plain")) {
				if (response.redirected) setCurrentRoute(response.url, true);
				const content = await response.text()
				document.body.innerHTML = '<pre style="all:initial;word-wrap: break-word; white-space: pre-wrap;">'+domUtils.escapeHtml(content)+'</pre>'
			}
			else {
				displayError("UIX Rendering Error", "Cannot render value with mime type \""+response.headers.get("content-type")+"\" on frontend");
			}
		}
		else if (response.status === 302) {
			window.location.href = response.headers.get("location")!;
		}
		else if (response.body) {
			console.warn("cannot handle response body on frontend (TODO)", response)
		}
		else {
			console.warn("cannot handle response on frontend (TODO)", response)
		}
	}

	isContentType(response: Response, mimeType: `${string}/${string}`) {
		const actualMimeType = response.headers.get("content-type") 
		return actualMimeType === mimeType || actualMimeType?.startsWith(mimeType + ";")
	}

	mergeContent(content: unknown) {
		console.log("mergeContent", content);

		// get elements list from content
		const elements = this.getElementsListFromContent(content);

		// no elements could be extracted
		if (!elements) {
			if (content instanceof Response) {
				// TODO:
				logger.warn("Content of type 'Response' cannot be merged with existing content, falling back to override");
				this.displayContent(content)
				return;
			}
			else {
				logger.warn("content is not valid");
				return;
			}
		}

		console.log("elements", elements)
		
		// insert into existing DOM
		for (const el of elements) {
			let slot:HTMLElement|null = null;
			if (el instanceof HTMLElement && el.hasAttribute("slot")) {
				const name = el.getAttribute("slot")!
				slot = querySelector(`frontend-slot[name="${domUtils.escapeHtml(name)}"]`) as HTMLElement;
				if (!slot) logger.error(`Could not find a matching <frontend-slot name="${name}"/> for content provided from the frontend entrypoint. Make sure your backend and frontend routes are not unintentionally colliding.`);
			}
			else {
				slot = querySelector("frontend-slot") as HTMLElement;
				if (!slot) logger.error("Could not find a matching <frontend-slot/> for content provided from frontend entrypoint. Make sure your backend and frontend routes are not unintentionally colliding.");
			}

			if (slot) {
				slot.innerHTML = "";
				domUtils.append(slot, el);
			}
		}


	}

	private getElementsListFromContent(content: unknown) {
		let elements = [];
		if (content instanceof DocumentFragment) elements = [...content.children as unknown as HTMLElement[]]
		else if (content instanceof Array) elements = content;
		else if (content instanceof Response) return null;
		else elements = [content];
		return elements;
	}


	async getContentFromEntrypoint(entrypoint: Entrypoint, route: URL|string, probe_no_side_effects = false) {

		route = route instanceof Path ? route : new Path(route, window.location.origin);

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

	getBackendContent(route: URL|string) {
		return this.getContentFromEntrypoint(this.#backendEntrypoint, route);
	}


	enableNavigationInterception() {

		if (globalThis.navigation) {
			// @ts-ignore
			globalThis.navigation?.addEventListener("navigate", (e:any)=>{
				
				if (!e.userInitiated || !e.canIntercept || e.downloadRequest || e.formData) return;
				
				const url = new URL(e.destination.url);
				// pass links to /@uix/...
				if (url.pathname.startsWith("/@uix/")) return;

				if (url.origin != new URL(window.location.href).origin) return;

				const router = this;

				// TODO: this intercept should be cancelled/not executed when the route is loaded from the server (determined in handleCurrentURLRoute)
				e.intercept({
					handler() {
						console.log("intercept", url)
						// render content
						return router.renderRouteContent(false, 'override', url);
					},
					focusReset: 'manual',
					scroll: 'manual'
				})
			})
		}

		// globalThis.addEventListener("click", (e) => {
		// 	const target = e.target as HTMLAnchorElement;
		// 	if (target.tagName === "A" && target.href) {
		// 		e.preventDefault();
		// 		this.navigateTo(target.href);
		// 	}
		// })
	}

}

export const frontendRouter = new FrontendRouter();

frontendRouter.enableNavigationInterception();

globalThis.frontendRouter = frontendRouter;