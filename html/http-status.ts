import { Entrypoint } from "./entrypoints.ts";

export class HTTPStatus {

	constructor(public readonly code: number, public readonly content?: Entrypoint) {}

	with(content: Entrypoint) {
		return new HTTPStatus(this.code, content);
	}

	// TODO add more status codes
	static BAD_REQUEST = new HTTPStatus(400);
	static UNAUTHORIZED = new HTTPStatus(401);
	static FORBIDDEN = new HTTPStatus(403);
	static NOT_FOUND = new HTTPStatus(404);

	static INTERNAL_SERVER_ERROR = new HTTPStatus(500);
}