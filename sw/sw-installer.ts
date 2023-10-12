// deno-lint-ignore-file no-namespace

import { logger } from "../utils/global-values.ts";

// TODO: remove
export namespace ServiceWorker {

	let activated = false;

	export async function register (path:string|URL) {
		if ('serviceWorker' in navigator) {
			const has_registration = (await navigator.serviceWorker.getRegistrations()).length;
			if (has_registration) {
				logger.debug("Service Worker already registered");
				return; // already registered
			}
			try {
				await navigator.serviceWorker.register(path);
				logger.success("Service Worker registered");
				activated = true;
			}
			catch (e) {
				logger.error("Error installing Service Worker: ?"+  e)
			}
		}
		else logger.error("Could not register Service Worker")
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