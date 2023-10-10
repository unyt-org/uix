import { Logger } from "unyt_core/utils/logger.ts";
import { getInjectedAppData } from "../app/app-data.ts";
// import { getServiceWorkerThread, ThreadModule } from "unyt_core/threads/threads.ts";

const logger = new Logger("background-runner")

// TODO: implement using getServiceWorkerThread as soon as import() is supported in service workers

export class BackgroundRunner {

	// declare thread: ThreadModule<typeof import("./runner-script.ts")>
	// async #init() {
	// 	this.thread = await getServiceWorkerThread<typeof import("./runner-script.ts")>("./runner-script.ts", window.location.origin + "/@uix/thread-worker.ts");
	// 	console.log("thread",this.thread)
	// }


	private constructor(){
		this.#handleSSECommand("ERROR", (data) => logger.error(data))
	}
	static #instance?: BackgroundRunner
	static async get() {
		if (!this.#instance) {
			this.#instance = new BackgroundRunner();
			// await this.#instance.#init()
		}
		return this.#instance;
	}

	#listeningToSSE = false;
	#commandCallbacks = new Map<string, Set<(data?: string)=>void>>();
	#listenToSSE() {
		if (this.#listeningToSSE) return true;

		const usid = getInjectedAppData()?.usid;

		if (!usid) return false;
		this.#listeningToSSE = true;
		const path = "/@uix/sse?usid=" + (usid??'');

		const evtSource = new EventSource(path, {
			withCredentials: true,
		});
		evtSource.addEventListener("message", (e) => {
			const [cmd, ...data] = (e.data as string).split(" ");

			if (this.#commandCallbacks.has(cmd)) {
				for (const callback of this.#commandCallbacks.get(cmd)!) callback(data.join(" "))
			}
		});

		evtSource.onopen = () => {
			logger.debug("listening to server side events (usid: "+usid+")")
		}

		// try fast reconnect
		evtSource.onerror = () => {
			evtSource.close();
			this.#listeningToSSE = false;
			setTimeout(()=>this.#listenToSSE(), 500)
		}
	}

	#handleSSECommand(cmd: string, callback: (data?:string)=>void) {
		const valid = this.#listenToSSE();
		if (!valid) return false;
		if (!this.#commandCallbacks.has(cmd)) this.#commandCallbacks.set(cmd, new Set())
		this.#commandCallbacks.get(cmd)!.add(callback);
		return true;
	}

	// TODO: implement with sw thread
	enableHotReloading() {
		const enabled = this.#handleSSECommand("RELOAD", () => window.location.reload())
		if (enabled) logger.success("Hot reloading enabled");
		else logger.error("Could not enable hot reloading");
	}

}