import { Logger } from "datex-core-legacy/utils/logger.ts";
import { addPersistentListener } from "datex-core-legacy/utils/persistent-listeners.ts";

const logger = new Logger("sse-listener")

declare const EventSource:any;

export class SSEListener {
	
	constructor(private params:Record<string,string>, private onOpen?: ()=>void){
		this.handleSSECommand("ERROR", (data) => logger.error(data))
	}

	#listeningToSSE = false;
	#commandCallbacks = new Map<string, Set<(data?: string)=>void>>();
	#listenToSSE() {
		if (this.#listeningToSSE) return;
		this.#listeningToSSE = true;

		const path = "/@uix/sse?" + new URLSearchParams(this.params).toString()

		const evtSource = new EventSource(path, {
			withCredentials: true,
		});
		evtSource.addEventListener("message", (e:any) => {
			const [cmd, ...data] = (e.data as string).split(" ");

			if (this.#commandCallbacks.has(cmd)) {
				for (const callback of this.#commandCallbacks.get(cmd)!) callback(data.join(" "))
			}
		});

		evtSource.onopen = this.onOpen

		// try fast reconnect
		evtSource.onerror = () => {
			evtSource.close();
			this.#listeningToSSE = false;
			setTimeout(()=>this.#listenToSSE(), 500)
		}

		addPersistentListener(globalThis, "beforeunload", () => {
			evtSource.close();
		})
	}

	handleSSECommand(cmd: string, callback: (data?:string)=>void) {
		this.#listenToSSE();
		if (!this.#commandCallbacks.has(cmd)) this.#commandCallbacks.set(cmd, new Set())
		this.#commandCallbacks.get(cmd)!.add(callback);
		return true;
	}

}