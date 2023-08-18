// deno-lint-ignore-file no-namespace
import { UIX } from "../uix.ts";

export namespace ServiceWorker {

	let activated = false;

	export async function register (path:string|URL) {
		if ('serviceWorker' in navigator) {
			const has_registration = (await navigator.serviceWorker.getRegistrations()).length;
			if (has_registration) {
				UIX.logger.debug("Service Worker already registered");
				return; // already registered
			}
			try {
				await navigator.serviceWorker.register(path);
				UIX.logger.success("Service Worker registered");
				activated = true;
			}
			catch (e) {
				UIX.logger.error("Error installing Service Worker: ?"+  e)
			}
		}
		else UIX.logger.error("Could not register Service Worker")
	}
	

	async function sendMessage(message:unknown){
		if (!activated) return false;
		const registration = await navigator.serviceWorker.ready;
		registration.active?.postMessage(message);
		return true;
	}

	export async function clearCache(){
		for (const registration of await navigator.serviceWorker.getRegistrations()) {
            registration.unregister()
        }
		// return sendMessage({type:"clear_cache"})
	}
}