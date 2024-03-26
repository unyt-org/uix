import { Context } from "../routing/context.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { Entrypoint, EntrypointProxy } from "./entrypoints.ts";

export type Credentials = {
	username: string,
	password: string
}

export class AuthorizationProxy extends EntrypointProxy {
	
	override redirect = undefined

	static readonly LOGIN_DIALOG = new Response("", {
		status: 401,
		statusText: 'Unauthorized',
		headers: {
			'WWW-Authenticate': 'Basic realm="Restricted Area"'
		}
	})

	#credentials: Credentials[]
	#unauthorizedEntrypoint?: Entrypoint

	constructor(credentials: Credentials[], authorizedEntrypoint?: Entrypoint, unauthorizedEntrypoint?: Entrypoint) {
		super(authorizedEntrypoint);
		this.#credentials = credentials;
		this.#unauthorizedEntrypoint = unauthorizedEntrypoint;
	}
	
	intercept(_route: Path, context: Context) {
		const credentials = context.request?.headers.get("Authorization");
	
		// has credentials
		if (credentials) {
			const base64 = credentials.split(" ")[1];
			const [_username, _password] = atob(base64).split(":");
			for (const {username, password} of this.#credentials??[]) {
				if (username === _username && password === _password) return null;
			}
		}
	
		// return fallback entryoint if unauthorized
		if (this.#unauthorizedEntrypoint) return this.#unauthorizedEntrypoint;
		// ask for credentials
		else return AuthorizationProxy.LOGIN_DIALOG;
	}

	transform = undefined

}