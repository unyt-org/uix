// deno-lint-ignore-file no-namespace

import { Path } from "../utils/path.ts";
import { resolveEntrypointRoute,  refetchRoute } from "./rendering.ts";
import { Datex } from "datex-core-legacy";
import { Entrypoint, html_content_or_generator } from "../html/entrypoints.ts";
import { KEEP_CONTENT } from "../html/entrypoint-providers.tsx";
import { displayError } from "../html/errors.tsx";
import { domUtils } from "../app/dom-context.ts";
import { PartialHydration } from "../hydration/partial-hydration.ts";
import { ContextBuilder } from "./context.ts";
import { querySelector } from "../uix-dom/dom/shadow_dom_selector.ts";
import { recreateGlobalStyleSheetLinks } from "../utils/css-style-compat.ts";
import { recreatePersistentListeners } from "datex-core-legacy/utils/persistent-listeners.ts";

/**
 * Generalized implementation for setting the route in the current tab URL
 * Used in combination with components
 * You should only use the Routing.update() method in most cases to update the current URL, and otherwise rely on the component specific routing implementation (resolveRoute, handleRoute, getInternalRoute)
 */

const logger = new Datex.Logger("UIX Routing");

export namespace Routing {

	let frontend_entrypoint: Entrypoint|undefined
	let backend_entrypoint: Entrypoint|undefined
	let current_entrypoint: Entrypoint|undefined
	let current_content: any;

	// @deprecated
	export const Prefix = {};
	export function setPrefix(){}

	export function getCurrentRouteFromURL() {
		return Path.Route(window.location.href ?? import.meta.url);
	}

	export function setCurrentRoute<S extends boolean>(url?:string|URL, silent?: S): S extends true ? boolean : Promise<boolean>
	export function setCurrentRoute<S extends boolean>(parts?:string[], silent?: S): S extends true ? boolean : Promise<boolean>
	export function setCurrentRoute(_route?:string|string[]|URL, silent = false) {
		if (!globalThis.history) return false;
		const route = Path.Route(_route);
		if (Path.routesAreEqual(getCurrentRouteFromURL(), route)) return false; // no change, ignore

		history.pushState(null, "", route.routename);
	
		if (!silent) return resolveCurrentRoute();
		else return true;
	}


	export async function setEntrypoints(frontend?: Entrypoint, backend?: Entrypoint, isHydrating = false, mergeFrontend: 'override'|'insert'|undefined = 'insert') {
		frontend_entrypoint = frontend;
		backend_entrypoint = backend;
		// entrypoints available - enable frontend routing
		if (frontend_entrypoint || backend_entrypoint) {
			enableFrontendRouting();
		}

		const backend_available = isHydrating || (backend_entrypoint ? await renderEntrypoint(backend_entrypoint) : false);
		const frontend_available = (mergeFrontend || !backend_available) && frontend_entrypoint ? await renderEntrypoint(frontend_entrypoint, backend_available ? mergeFrontend : undefined) : false;

		// no content for path found after initial loading
		if (!frontend_available && !backend_available) {
			displayError("No content", `Route resolved to null on the ${backend_entrypoint?'backend':''}${(backend_entrypoint&&frontend_entrypoint?' and ': '')}${frontend_entrypoint?'frontend':''}`)
		}
	}

	export async function renderEntrypoint(entrypoint:Entrypoint, mergeType?: 'override'|'insert') {
		const content = await getContentFromEntrypoint(entrypoint, undefined)
		if (content != null && content !== KEEP_CONTENT) {
			if (mergeType == "insert") {

				let elements = [];
				if (content instanceof DocumentFragment) elements = [...content.children]
				else if (content instanceof Array) elements = content;
				else if (content instanceof Response) {
					logger.error("Frontend entrypoint returned a Response object - this cannot be merged with the provided backend content");
				}
				else elements = [content];

				for (const el of elements) {
					let slot:HTMLElement|null = null;
					if (el instanceof HTMLElement && el.hasAttribute("slot")) {
						const name = el.getAttribute("slot")!
						slot = querySelector(`frontend-slot[name="${domUtils.escapeHtml(name)}"]`) as HTMLElement;
						if (!slot) logger.error(`Could not find a matching <frontend-slot name="${name}"/>`);
					}
					else {
						slot = querySelector("frontend-slot") as HTMLElement;
						if (!slot) logger.error("Could not find a matching <frontend-slot/>");
					}
	
					if (slot) {
						slot.innerHTML = "";
						slot.append(el);
					}
				}				
			}
			else await setContent(content, entrypoint)
		}
		return content != null
	}


	async function getContentFromEntrypoint(entrypoint: Entrypoint, route: Path.Route = getCurrentRouteFromURL(), probe_no_side_effects = false) {
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

	async function setContent(content: html_content_or_generator, entrypoint:Entrypoint) {
		current_entrypoint = entrypoint;

		if (current_content !== content) {
			current_content = content;
			// TODO:
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
				renderResponse(content)
			}

			// TODO: currently only displayed if type not correctly mapped (TypedValue fallback)
			else if (!(content instanceof Datex.TypedValue)) { //if (content instanceof Element || content instanceof DocumentFragment) {
				document.body.innerHTML = "";
				// TODO: handle all content correctly (same behaviour as on backend)
				domUtils.append(document.body, content) // add to document
			}
			else {
				displayError("UIX Rendering Error", "Cannot render value of type " + Datex.Type.ofValue(content));
			}
			// else {
			// 	logger.error("invalid content, cannot handle yet", content)
			// 	return;
			// }
		}
	
		await update(getCurrentRouteFromURL(), false)
	}

	/**
	 * Render a Response on the client side
	 * @param response 
	 */
	async function renderResponse(response: Response) {
		if (response.body instanceof ReadableStream) {
			if (isContentType(response, "text/html")) {
				if (response.redirected) setCurrentRoute(response.url, true);
				try {
					document.write(await response.text());
				}
				catch (e) {
					console.error(e)
				}
				// important: insert global style sheet urls from already loaded component classes again
				await recreateGlobalStyleSheetLinks()
				recreatePersistentListeners()
				document.close();
			}
			else if (isContentType(response, "text/plain")) {
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

	function isContentType(response: Response, mimeType: `${string}/${string}`) {
		const actualMimeType = response.headers.get("content-type") 
		return actualMimeType === mimeType || actualMimeType?.startsWith(mimeType + ";")
	}

	async function resolveCurrentRouteFrontend(){
		// try frontend entrypoint
		if (frontend_entrypoint) {
			const content = await getContentFromEntrypoint(frontend_entrypoint)
			if (content !== null) {
				const entrypoint = frontend_entrypoint;
				return {content, entrypoint}
			}
			else {
				displayError("UIX Rendering Error", "Route not found on backend or frontend");
				return {}
			}
		}
		else {
			displayError("UIX Rendering Error", "Route not found on backend or frontend");
			return {};
		}
	}

	async function resolveCurrentRoute(allowReload=true){
		let content:any;
		let entrypoint:Entrypoint|undefined;

		// first check if we can guarantee that the frontend route exists (might still be blocked by a backend route, but this is the
		// best tradeoff for now)
		const frontendRouteExists = await getContentFromEntrypoint(frontend_entrypoint, getCurrentRouteFromURL(), true)
		if (frontendRouteExists !== null) {
			({content, entrypoint} = await resolveCurrentRouteFrontend());
			if (content !== null) {
				setContent(content, entrypoint!);
				return true;
			}
		}

		// try to load backend route content
		const backendResponse = await fetch(getCurrentRouteFromURL().routename, {
			credentials: "include",
			headers: {
				'UIX-Inline-Backend': 'true' // prevent duplicate loading of importmap (leads to errors)
			}
		})

		// handle redirect (does not matter if response ok or not)
		if (backendResponse.redirected) setCurrentRoute(backendResponse.url, true);

		// load backend content
		if (backendResponse.ok) {
			// is supported mime type for frontend rendering?
			if (isContentType(backendResponse, "text/html") || isContentType(backendResponse, "text/plain")) {
				content = backendResponse
			}
			// reload window to correctly display backend response
			// TODO: better solution?
			else {
				window.location.reload()
			}
		}

		else {
			console.log("not ok",backendResponse,frontend_entrypoint);
			({content, entrypoint} = await resolveCurrentRouteFrontend());
		}

		setContent(content, entrypoint!);
		return true;

		// // try backend entrypoint
		// if (content == null && backend_entrypoint) {
		// 	content = await getContentFromEntrypoint(backend_entrypoint);
		// 	entrypoint = backend_entrypoint;
		// }
		// if (!frontend_entrypoint && !backend_entrypoint) {
		// 	const inferred_entrypoint = getInferredDOMEntrypoint();
		// 	const _content = await getContentFromEntrypoint(inferred_entrypoint);
		// 	const refetched_route = await refetchRoute(getCurrentRouteFromURL(), inferred_entrypoint);
			
		// 	// check of accepted route matches new calculated current_route
		// 	if (!Path.routesAreEqual(getCurrentRouteFromURL(), refetched_route)) {
		// 		logger.warn `invalid route from inferred frontend entrypoint, reloading page from backend`; 
		// 		if (allowReload) window?.location?.reload?.()
		// 		return false
		// 	}
		// 	// window.location.reload()
		// 	return true;
		// 	// TODO: what to do with returned content (full entrypoint route not known)
		// }

		// // still nothing found - route could not be fully resolved on frontend, try to reload from backend
		// if (content == null) {
		// 	logger.warn `no content for ${getCurrentRouteFromURL().routename}, reloading page from backend`; 
		// 	if (allowReload) window?.location?.reload?.()
		// 	return false;
		// }

		// await setContent(content, entrypoint!);
	}

	function getInferredDOMEntrypoint(){
		return document.body.children[0] instanceof Element ? document.body.children[0] : null
	}

	const INITIAL_LOAD = Symbol("INITIAL_LOAD")

	/**
	 * updates the current URL with the current route requested from the get_handler
	 */
	export async function update(route_should_equal?:Path.route_representation, load_current_new = false){

		const current = getCurrentRouteFromURL();
		const route = route_should_equal ?? current;

		// first load current route
		if (load_current_new) await resolveCurrentRoute();

		let changed = !!route_should_equal;

		const usingInferredEntrypoint = !current_entrypoint; // reconstructing entrypoint from DOM. Probable reason: content was server side rendered
		const entrypoint = current_entrypoint// ?? getInferredDOMEntrypoint();

		if (entrypoint) {
			// entrypoint was inferred but inferred entrypoint was not yet initially routed
			if (usingInferredEntrypoint) {
				const loadedInitial = entrypoint[INITIAL_LOAD];
				entrypoint[INITIAL_LOAD] = true;
				if (!loadedInitial) await resolveCurrentRoute();
			} 

			// TODO: use route refetching?
			// const refetched_route = await refetchRoute(route, entrypoint);// Path.Route(await (<RouteManager>current_content).getInternalRoute());
			// // check if accepted route matches new calculated current_route
			// if (route_should_equal && !Path.routesAreEqual(route_should_equal, refetched_route)) {
			// 	logger.warn `new route should be "${Path.Route(route_should_equal).routename}", but was changed to "${refetched_route.routename}". Make sure getInternalRoute() and onRoute() are consistent in all components.`;
			// 	// stop ongoing loading animation
			// 	window.stop()
			// 	// something is wrong, content was server side rendered, routes might not be resolved correctly, better reload to get server routing
			// 	if (usingInferredEntrypoint) window.location.href = Path.Route(route_should_equal).routename; 
			// }

			// // must be updated to new
			// if (!Path.routesAreEqual(current, refetched_route)) {
			// 	changed = setCurrentRoute(refetched_route, true); // update silently
			// }
		}

		if (changed) logger.success `new route: ${getCurrentRouteFromURL().routename??"/"}`;

	}

	let frontendRoutingEnabled = false;

	function enableFrontendRouting() {
		if (frontendRoutingEnabled) return;
		frontendRoutingEnabled = true;
		logger.debug("frontend routing enabled");

		// listen for history changes

		// @ts-ignore
		if (globalThis.navigation) {
			// @ts-ignore
			globalThis.navigation?.addEventListener("navigate", (e:any)=>{
				
				if (!e.userInitiated || !e.canIntercept || e.downloadRequest || e.formData) return;
				
				const url = new URL(e.destination.url);
				// pass links to /@uix/...
				if (url.pathname.startsWith("/@uix/")) return;

				if (url.origin != new URL(window.location.href).origin) return;

				// TODO: this intercept should be cancelled/not executed when the route is loaded from the server (determined in handleCurrentURLRoute)
				e.intercept({
					async handler() {
						await resolveCurrentRoute();
					},
					focusReset: 'manual',
					scroll: 'manual'
				})
				e.s
			})
		}

		// fallback if "navigate" event not supported - only works for # paths, otherwise, page is reloaded
		else {
			globalThis.addEventListener('popstate', (e) => {
				resolveCurrentRoute();
			})
		}
	}

}