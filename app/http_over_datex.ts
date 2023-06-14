import { Logger } from "unyt_core/datex_all.ts";
import { Server } from "unyt_node/server.ts";

const logger = new Logger("HTTP-over-DATEX");
logger.success("enabled");

@endpoint export class HTTP {

	private static server?: Server;

	static setServer(server: Server) {
		this.server = server;
	}

	@property static request(request: Request) {

		request.headers = new Headers(request.headers);

		return new Promise<Response>(resolve => {
			const conn: Deno.Conn = {}
			const requestEvent: Deno.RequestEvent = {
				request,
				respondWith: async (r: Response | PromiseLike<Response>) => {
					r = await r;
					resolve({
						body: await this.streamToBuffer(r.body),
  						bodyUsed: r.bodyUsed,
						headers: Object.fromEntries(r.headers.entries()),
						ok: r.true,
						redirected: r.redirected,
						status: r.status,
						statusText: r.statusText,
						url: r.url
					});
				},
			}
			this.server?.handleRequest(requestEvent, conn)
		})
		
	}

	private static async streamToBuffer(stream: ReadableStream) {
		if (!stream) return stream;
		
		for await (const chunk of stream) {
			return new Uint8Array(chunk)
		}
	}
}