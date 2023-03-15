// deno-lint-ignore-file no-namespace

import { Logger } from "unyt_core/datex_all.ts";
import { collapseToContent, Entrypoint, html_content_or_generator, provideError, RenderMethod, RoutingSink } from "../html/rendering.ts";
import { HTMLUtils } from "../html/utils.ts";

/**
 * Generalized implementation for setting the route in the current tab URL
 * Used in combination with components
 * You should only use the Routing.update() method in most cases to update the current URL, and otherwise rely on the component specific routing implementation (resolveRoute, handleRoute, getInternalRoute)
 */

const logger = new Logger("UIX Routing");

export namespace Routing {

	export enum Prefix {
		LOCAL_HASH = "#",
		PATH = "/"
	}

	let frontend_entrypoint: Entrypoint|undefined
	let backend_entrypoint: Entrypoint|undefined

	let current_content: any;

	// @deprecated, just use '#' directly in routes when local routing is required
	export function setPrefix(new_prefix: never) {
		console.warn("UIX.Routing.setPrefix is deprecated, just use '#' directly in routes when local routing is required")
		// prefix = new_prefix;
	}

	export function getCurrentRouteFromURL() {
		return getRouteFromURL(window.location?.href ?? import.meta.url);
	}

	export function getCurrentRouteStringFromURL() {
		const url = new URL(window.location?.href ?? import.meta.url);
		return "/" + url.pathname.slice(1) + url.hash
	}

	export function getRouteFromURL(url:string|URL) {
		url = new URL(url);
		const path = url.pathname.slice(1) + url.hash;
		let parts = path.split("/");
		if (parts.length == 1 && parts[0] == '') parts = []; // empty
		return parts;
	}

	export function setCurrentRoute(url?:string|URL, silent?: boolean):Promise<void>
	export function setCurrentRoute(parts?:string[], silent?: boolean):Promise<void>
	export function setCurrentRoute(parts?:string|string[]|URL, silent = false) {
		if (!globalThis.history) return;
		if (JSON.stringify(getCurrentRouteFromURL()) === JSON.stringify(parts instanceof URL ? getRouteFromURL(parts) : parts)) return; // no change, ignore

		if (!parts || (parts instanceof Array && !parts.length)) history.pushState(null, "", "/");
		else {
			let url:URL|string;
			if (parts instanceof URL || typeof parts == "string") url = new URL(parts);
			else {
				url = "/" + parts.join("/");
				if (url.startsWith("//")) url = url.slice(1);
			}
			console.log("new " + url,silent)
			history.pushState(null, "", url)
		}

		if (!silent) return handleCurrentURLRoute();
	}


	export async function setEntrypoints(frontend?: Entrypoint, backend?: Entrypoint) {
		frontend_entrypoint = frontend;
		backend_entrypoint = backend;
		const backend_available = backend_entrypoint ? await initEndpointContent(backend_entrypoint) : false;
		const frontend_available = frontend_entrypoint ? await initEndpointContent(frontend_entrypoint) : false;
		// no content for path found after initial loading
		if (!frontend_available && !backend_available) {
			document.body.innerHTML = await (await provideError("Page not found on frontend")).text();
		}
	}


	async function initEndpointContent(entrypoint:Entrypoint) {
		const content = await getContentFromEntrypoint(entrypoint)
		if (content != null) setContent(content)
		return content != null
	}

	async function getContentFromEntrypoint(entrypoint: Entrypoint, path: string = getCurrentRouteStringFromURL()) {
		const [collapsed_content, _render_method] = <[html_content_or_generator, RenderMethod]><any> await collapseToContent(entrypoint, path, undefined, false);
		return collapsed_content;
	}

	function setContent(content: html_content_or_generator, path: string = getCurrentRouteStringFromURL()) {
		if (current_content == content) return;
		current_content = content;
		document.body.innerHTML = "";
        // console.log("-->",collapsed_content)
        HTMLUtils.append(document.body, content) // add to document
        // loadingFinished();
        logger.success("loaded " + (path??"/"));
	}


	async function handleCurrentURLRoute(){
		let content:any;

		// try frontend entrypoint
		if (frontend_entrypoint) content = await getContentFromEntrypoint(frontend_entrypoint)
		// try backend entrypoint
		if (content == null && backend_entrypoint) content = await getContentFromEntrypoint(backend_entrypoint);

		// still nothing found - route could not be fully resolved on frontend, try to reload from backend
		if (content == null) {
			logger.warn("no content for " + getCurrentRouteStringFromURL())
			window.location.reload();
		}

		setContent(content);
		await update(getCurrentRouteFromURL(), false)
		// if (!current_set_handler) return;
		// const route = getCurrentRouteFromURL();
		// if (route.length) {
		// 	const valid_route_part = await current_set_handler(route);
		// 	console.log(route,valid_route_part)

		// 	// route could not be fully resolved on frontend, try to reload from backend
		// 	if (route.join("/") !== valid_route_part.join("/")) {
		// 		if (window.location) window.location.pathname = route.join("/")
		// 		// logger.warn `invalid route "/${route.join("/")}" - redirected to "/${valid_route_part.join("/")}"`;
		// 	}
		// 	await update(valid_route_part);
		// }
		// else await update()
	}

	/**
	 * updates the current URL with the current route requested from the get_handler
	 */
	export async function update(compare?:string[], load_current_new = false){

		// first load current route
		if (load_current_new) await handleCurrentURLRoute();

		if (typeof current_content?.getInternalRoute !== "function") return;
		const current_route = await (<RoutingSink>current_content).getInternalRoute();
		if (current_route.length == 1 && current_route[0] == "") current_route.shift();

		console.log("update with current_content", current_content, current_route);

		// check of accepted route matches new calculated current_route
		if (compare && (compare.join("/") !== current_route.join("/"))) {
			logger.warn `new route should be "/${compare.join("/")}", but was changed to "/${current_route.join("/")}". Make sure getInternalRoute() and resolveRoute() are consistent in all components.`;
		}
		setCurrentRoute(current_route, true); // update silently
	}


	// listen for history changes
	// globalThis.addEventListener('popstate', (e) => {
	// 	handleCurrentURLRoute();
	// });

	// @ts-ignore
	globalThis.navigation?.addEventListener("navigate", (e:any)=>{
		if (!e.userInitiated || !e.canIntercept || e.downloadRequest || e.formData) return;
		const url = new URL(e.destination.url);
		if (url.origin != new URL(window.location.href).origin) return;

		console.log("nav " + url, e)
		e.intercept({
			async handler() {
				await handleCurrentURLRoute();
			}
		})
	})



}