// deno-lint-ignore-file no-namespace

/**
 * Generalized implementation for setting the route in the current tab URL
 * Used in combination with components
 * You should only use the Routing.update() method in most cases to update the current URL, and otherwise rely on the component specific routing implementation (onRoute, handleRoute, getCurrentRoute)
 */

export namespace Routing {

	export enum Prefix {
		LOCAL_HASH = "#",
		PATH = "/@/" // @experimental, currently not working
	}

	type set_handler = (parts:string[])=>string[]
	type get_handler = ()=>string[]

	let prefix:Prefix = Prefix.LOCAL_HASH; 
	let current_set_handler:set_handler
	let current_get_handler:get_handler

	export function setPrefix(new_prefix: Prefix) {
		prefix = new_prefix;
	}

	export function getCurrentRouteFromURL() {
		const url = new URL(window.location.href);
		const path = prefix == Prefix.LOCAL_HASH ? url.hash.replace(Prefix.LOCAL_HASH, "") : url.pathname.replace(Prefix.PATH, "");
		let parts = path.split("/");
		if (parts.length == 1 && parts[0] == '') parts = []; // empty
		return parts;
	}

	export function setCurrentRoute(parts?:string[], silent = false) {
		if (JSON.stringify(getCurrentRouteFromURL()) === JSON.stringify(parts)) return; // no change, ignore

		if (!parts?.length) history.pushState(null, "", "/");
		else history.pushState(null, "", prefix + parts.join("/"))

		if (!silent) handleCurrentURLRoute();
	}

	/**
	 * set the handler that gets called when the route is changed
	 * @param set_handler gets a path array, and returns the part of the path array that could be resolved (ideally the same array)
	 * @param get_Handler returns the current route that should be used in the URL when called
	 */
	export function setHandler(set_handler:set_handler, get_handler:get_handler) {
		current_set_handler = set_handler;
		current_get_handler = get_handler;
		handleCurrentURLRoute();
	}

	function handleCurrentURLRoute(){
		if (!current_set_handler) return;
		const route = getCurrentRouteFromURL();
		if (route.length) {
			const valid_route_part = current_set_handler(route);
			setCurrentRoute(valid_route_part, true); // update to valid part of route
		}
		// TODO is the returned path above required, if it is updated again afterwards?
		update();
	}

	/**
	 * updates the current URL with the current route requested from the get_handler
	 */
	export function update(){
		if (!current_get_handler) return;
		const current_route = current_get_handler();
		setCurrentRoute(current_route, true); // update silently
	}


	// listen for history changes
	globalThis.addEventListener('popstate', () => {
		handleCurrentURLRoute();
	});

}