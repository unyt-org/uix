import { Logger } from "datex-core-legacy/utils/logger.ts";
import { getInjectedAppDataStandalone } from "../app/app-data-standalone.ts";
import { SSEListener } from "./sse-listener.ts";
import { querySelector } from "../uix-dom/dom/shadow_dom_selector.ts";
// import { getServiceWorkerThread, ThreadModule } from "datex-core-legacy/threads/threads.ts";

const logger = new Logger("background-runner")

// TODO: implement using getServiceWorkerThread as soon as import() is supported in service workers

export class BackgroundRunner {

	// declare thread: ThreadModule<typeof import("./runner-script.ts")>
	// async #init() {
	// 	this.thread = await getServiceWorkerThread<typeof import("./runner-script.ts")>("./runner-script.ts", globalThis.location.origin + "/@uix/thread-worker.ts");
	// 	console.log("thread",this.thread)
	// }

	static #instance?: BackgroundRunner
	static get() {
		if (!this.#instance) {
			this.#instance = new BackgroundRunner();
			// await this.#instance.#init()
		}
		return this.#instance;
	}

	#hotReloadListener?: SSEListener;

	// TODO: implement with sw thread
	enableHotReloading() {
		if (this.#hotReloadListener) return;
		const usid = getInjectedAppDataStandalone()?.usid;
		if (!usid) {
			logger.error("Could not enable hot reloading");
			return false;
		}

		this.#hotReloadListener = new SSEListener(
			{'usid': usid},
			() => logger.debug("listening to server side events (usid: "+usid+")")
		)
		// reload window on RELOAD command
		this.#hotReloadListener.handleSSECommand("RELOAD", () => globalThis.location.reload())
		return true;
	}

	observePointers(ids:string[]) {
		const listener = new SSEListener({
			'observe': JSON.stringify(ids)
		});
		// TODO: handle element updates
		listener.handleSSECommand("UPDATE_TEXT", () => {

		})
		listener.handleSSECommand("UPDATE_HTML", () => {

		})
		listener.handleSSECommand("ATTR", (cmd) => {
			const [ptrId, attr] = cmd!.split(" ")
			const value = JSON.parse(cmd?.replace(/\S* \S* /, "")??"");
			const el = querySelector(`[uix-ptr="${ptrId}"]`);
			console.debug("attr", el, ptrId, attr, value);
			if (el) {
				if (value == null) el.removeAttribute(attr);
				else el.setAttribute(attr, value);
			}
			else {
				logger.error("Element " + ptrId + " not found");
			}
		})
		listener.handleSSECommand("PROP", (cmd) => {
			const [ptrId, attr] = cmd!.split(" ")
			const value = JSON.parse(cmd?.replace(/\S* \S* /, "")??"");
			const el = querySelector(`[uix-ptr="${ptrId}"]`);
			console.debug("prop", el, ptrId, attr, value);
			if (el) {
				el[attr] = value;
			}
			else {
				logger.error("Element " + ptrId + " not found");
			}
		})
	}

}