import { Logger } from "unyt_core/datex_all.ts";
import { Server } from "../server/server.ts";

const logger = new Logger("HTTP-over-DATEX");
logger.success("enabled");

@endpoint export class HTTP {

	private static server?: Server;

	static setServer(server: Server) {
		this.server = server;
	}

	@property static request(request: Request) {

		// @ts-ignore clone headers (TODO: required why?)
		request.headers = new Headers(request.headers);

		return new Promise(resolve => {
			const conn: Deno.Conn = {} as Deno.Conn;
			const requestEvent: Deno.RequestEvent = {
				request,
				respondWith: async (r: Response | PromiseLike<Response>) => {
					r = await r;
					resolve({
						body: await this.streamToBuffer(r.body),
  						bodyUsed: r.bodyUsed,
						headers: Object.fromEntries((r.headers as any).entries()),
						ok: r.ok,
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

	private static async streamToBuffer(stream: ReadableStream|null) {
		if (!stream) return stream;
		
		const parts = []
		for await (const chunk of stream) {
			parts.push(new Uint8Array(chunk))
		}
		
		return this.concat(parts)
	}

	private static concat(arrays:Uint8Array[]) {
		if (arrays.length == 1) return arrays[0];
		
		const totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
		const result = new Uint8Array(totalLength);
	  
		if (!arrays.length) return result;

		let length = 0;
		for (const array of arrays) {
		  result.set(array, length);
		  length += array.length;
		}
	  
		return result;
	  }
}