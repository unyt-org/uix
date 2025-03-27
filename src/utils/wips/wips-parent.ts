import { logger } from "../global-values.ts";
import { WIPSMessageToChild, WIPSMessageToParent } from "./types.ts";

function initWIPSParent() {

	const receiveHandlers: Set<(msg: WIPSMessageToParent) => void> = new Set();

	const sendMessage = (msg: WIPSMessageToChild) => {
		if (!socket) {
			logger.error("WIPS: child process not connected");
			return;
		}
		socket.send(msg);
	}

	let socket: WebSocket | undefined;

	const server = Deno.serve({port: 0, onListen: ()=>{}}, (req) => {
		if (req.headers.get("upgrade") != "websocket") {
		  return new Response(null, { status: 501 });
		}
		const { socket: newSocket, response } = Deno.upgradeWebSocket(req);
		// close previous socket
		if (socket) {
			try {
				socket.close();
			}
			catch {/* ignore */}
		}
		socket = newSocket;
		socket.addEventListener("open", () => {
		  logger.info("WIPS: connected to child process");
		});
		socket.addEventListener("message", (event) => {
			const msg = event.data;
			for (const handler of receiveHandlers) {
				handler(msg);
			}
		});
		return response;
	});

	return {
		port: server.addr.port,
		sendMessage,
		onReceive: (handler: (msg: WIPSMessageToParent) => void) => {
			receiveHandlers.add(handler);
		}
	};
}

export const wipsParent = initWIPSParent();