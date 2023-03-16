export type RequestData = Request & {localAddr:Deno.Addr, remoteAddr:Deno.Addr, path:string}

export class Context {
	request?: RequestData
	language = "en";
}

export class ContextBuilder {

	#ctx = new Context()

	setRequestData(req:Deno.RequestEvent, path:string, con:Deno.Conn) {
		this.#ctx.request = <any>{}
		Object.assign(this.#ctx.request!, req.request)
		// @ts-ignore headers copied from prototype?
		this.#ctx.request!.headers = req.request.headers;

		this.#ctx.request!.localAddr = con.localAddr
		this.#ctx.request!.remoteAddr = con.remoteAddr
		this.#ctx.request!.path = path;

		return this;
	}

	build() {
		return this.#ctx;
	}
}


export type ContextGenerator = ()=>Context