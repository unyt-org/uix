import { Datex } from "datex-core-legacy/mod.ts";
import { Entrypoint } from "../providers/entrypoints.ts";

export class HTTPStatus<Code extends number = number, T extends Entrypoint = Entrypoint> {

	constructor(public readonly code: Code, public readonly content?: T) {}

	with(content: Entrypoint) {
		return new HTTPStatus(this.code, content);
	}

	static #map:Record<number,HTTPStatus<number, Entrypoint>> = {}

	static #setDefault<T extends HTTPStatus<number, Entrypoint>>(status: T): T {
		this.#map[status.code] = status;
		return status;
	}

	static get(code: number) {
		return this.#map[code];
	}

	static CONTINUE = this.#setDefault(new HTTPStatus(100));
	static SWITCHING_PROTOCOLS = this.#setDefault(new HTTPStatus(101));
	static PROCESSING = this.#setDefault(new HTTPStatus(102));
	static EARLY_HINTS = this.#setDefault(new HTTPStatus(103));
	
	static OK = this.#setDefault(new HTTPStatus(200));
	static CREATED = this.#setDefault(new HTTPStatus(201));
	static ACCEPTED = this.#setDefault(new HTTPStatus(202));
	static NON_AUTHORITATIVE_INFORMATION = this.#setDefault(new HTTPStatus(203));
	static NO_CONTENT = this.#setDefault(new HTTPStatus(204));
	static RESET_CONTENT = this.#setDefault(new HTTPStatus(205));
	static PARTIAL_CONTENT = this.#setDefault(new HTTPStatus(206));
	static MULTI_STATUS = this.#setDefault(new HTTPStatus(207));
	static ALREADY_REPORTED = this.#setDefault(new HTTPStatus(208));
	static IM_USED = this.#setDefault(new HTTPStatus(226));

	static MULTIPLE_CHOICES = this.#setDefault(new HTTPStatus(300));
	static MOVED_PERMANENTLY = this.#setDefault(new HTTPStatus(301));
	static FOUND = this.#setDefault(new HTTPStatus(302));
	static SEE_OTHER = this.#setDefault(new HTTPStatus(303));
	static NOT_MODIFIED = this.#setDefault(new HTTPStatus(304));
	static USE_PROXY = this.#setDefault(new HTTPStatus(305));
	static SWITCH_PROXY = this.#setDefault(new HTTPStatus(306));
	static TEMPORARY_REDIRECT = this.#setDefault(new HTTPStatus(307));
	static PERMANENT_REDIRECT = this.#setDefault(new HTTPStatus(308));

	static BAD_REQUEST	= this.#setDefault(new HTTPStatus(400, new Response("Bad Request")));
	static UNAUTHORIZED = this.#setDefault(new HTTPStatus(401, new Response("Unauthorized")));
	static FORBIDDEN 	= this.#setDefault(new HTTPStatus(403, new Response("Forbidden")));
	static NOT_FOUND 	= this.#setDefault(new HTTPStatus(404, new Response("Not Found")));
	static METHOD_NOT_ALLOWED = this.#setDefault(new HTTPStatus(405, new Response("Method Not Allowed")));
	static CONFLICT = this.#setDefault(new HTTPStatus(409, new Response("Conflict")));
	static GONE = this.#setDefault(new HTTPStatus(410, new Response("Gone")));
	static LENGTH_REQUIRED = this.#setDefault(new HTTPStatus(411, new Response("Length Required")));
	static PAYLOAD_TOO_LARGE = this.#setDefault(new HTTPStatus(413, new Response("Payload Too Large")));
	static URI_TOO_LONG = this.#setDefault(new HTTPStatus(414, new Response("URI Too Long")));
	static UNSUPPORTED_MEDIA_TYPE = this.#setDefault(new HTTPStatus(415, new Response("Unsupported Media Type")));
	static RANGE_NOT_SATISFIABLE = this.#setDefault(new HTTPStatus(416, new Response("Range Not Satisfiable")));
	static EXPECTATION_FAILED = this.#setDefault(new HTTPStatus(417, new Response("Expectation Failed")));
	static TEAPOT = this.#setDefault(new HTTPStatus(418, new Response("I'm a teapot")));
	static UPGRADE_REQUIRED = this.#setDefault(new HTTPStatus(426, new Response("Upgrade Required")));
	static PRECONDITION_FAILED = this.#setDefault(new HTTPStatus(412, new Response("Precondition Failed")));
	static TOO_MANY_REQUESTS = this.#setDefault(new HTTPStatus(429, new Response("Too Many Requests")));

	static INTERNAL_SERVER_ERROR = this.#setDefault(new HTTPStatus(500, new Response("Internal Server Error")));
	static NOT_IMPLEMENTED = this.#setDefault(new HTTPStatus(501, new Response("Not Implemented")));
	static BAD_GATEWAY = this.#setDefault(new HTTPStatus(502, new Response("Bad Gateway")));
	static SERVICE_UNAVAILABLE = this.#setDefault(new HTTPStatus(503, new Response("Service Unavailable")));
	static GATEWAY_TIMEOUT = this.#setDefault(new HTTPStatus(504, new Response("Gateway Timeout")));
	static HTTP_VERSION_NOT_SUPPORTED = this.#setDefault(new HTTPStatus(505, new Response("HTTP Version Not Supported")));
	static NETWORK_AUTHENTICATION_REQUIRED = this.#setDefault(new HTTPStatus(511, new Response("Network Authentication Required")));

	toString() {
		return `HTTP Status ${this.code}: ${String(this.content)}`
	}
}


Datex.Type.get("uix:HTTPStatus").setJSInterface({
    class: HTTPStatus,
	is_normal_object : true
})
