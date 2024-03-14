import { Datex } from "datex-core-legacy";
import { Server } from "../server/server.ts";

const logger = new Datex.Logger("HTTP-over-DATEX");
logger.debug("enabled");

@endpoint export class HTTP {

	private static server?: Server;

	static setServer(server: Server) {
		this.server = server;
	}

	@property static async request(requestObj: any/*Request*/) {

		// @ts-ignore clone headers (TODO: required why?)
		requestObj.headers = new Headers(requestObj.headers);
		const request = new Request(requestObj.url, requestObj)

		return new Promise(resolve => {
			const conn: Deno.Conn = {} as Deno.Conn;
			const requestEvent: Deno.RequestEvent = {
				request,
				respondWith: async (r: Response | PromiseLike<Response>) => {
					r = await r;
					resolve({
						body: (await this.streamToBuffer(r.body))?.buffer,
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