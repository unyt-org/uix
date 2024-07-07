import { Datex } from "datex-core-legacy/mod.ts";
import { Entrypoint } from "./entrypoints.ts";

export class HTTPStatus<Code extends number = number, T extends Entrypoint = Entrypoint> {

	constructor(public readonly code: Code, public readonly content?: T) {}

	with(content: Entrypoint) {
		return new HTTPStatus(this.code, content);
	}

	static #map:Record<number,HTTPStatus<number, string>> = {}

	static #setDefault<T extends HTTPStatus<number, string>>(status: T): T {
		this.#map[status.code] = status;
		return status;
	}

	static get(code: number) {
		return this.#map[code];
	}

	// TODO add more status codes
	static BAD_REQUEST	= this.#setDefault(new HTTPStatus(400, "Bad Request"));
	static UNAUTHORIZED = this.#setDefault(new HTTPStatus(401, "Unauthorized"));
	static FORBIDDEN 	= this.#setDefault(new HTTPStatus(403, "Forbidden"));
	static NOT_FOUND 	= this.#setDefault(new HTTPStatus(404, "Not Found"));

	static INTERNAL_SERVER_ERROR = new HTTPStatus(500, "Internal Server Error");

	toString() {
		return `HTTP Status ${this.code}: ${String(this.content)}`
	}
}


Datex.Type.get("uix:HTTPStatus").setJSInterface({
    class: HTTPStatus,
	is_normal_object : true
})
