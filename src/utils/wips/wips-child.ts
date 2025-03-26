import { logger } from "../global-values.ts";
import { WIPSMessageToChild, WIPSMessageToParent } from "./types.ts";

async function initWIPSChild() {
	const { _wipsPort } = await import("../../app/args.ts");
	const wipsPort = _wipsPort;
	if (!wipsPort) {
		throw new Error("Cannot establish a connection to the runner process");
	}
	const wipsURL = `ws://localhost:${wipsPort}`;
	const ws = new WebSocket(wipsURL);

	const {promise, resolve} = Promise.withResolvers<void>();

	ws.addEventListener("open", () => {
		resolve();
	});

	ws.addEventListener("close", () => {
		logger.error("WIPS: Disconnected from runner process");
	});

	await promise;
	return {
		sendMessage: (msg: WIPSMessageToParent) => {
			ws.send(msg);
		},
		onReceive: (handler: (msg: WIPSMessageToChild) => void) => {
			ws.addEventListener("message", (event) => {
				handler(event.data);
			});
		},
		onReceiveOnce: (message: WIPSMessageToChild, handler: () => void) => {
			const listener = (event: MessageEvent) => {
				if (event.data == message) {
					handler();
					ws.removeEventListener("message", listener);
				}
			};
			ws.addEventListener("message", listener);
		}
	};
}


export const wipsChild = await initWIPSChild();