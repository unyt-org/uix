import { Path } from "unyt_node/path.ts";
import { UIX } from "uix";

export type Credentials = {
	username: string,
	password: string
}

export class AuthorizationProxy extends UIX.EntrypointProxy {

	static readonly LOGIN_DIALOG = new Response("", {
		status: 401,
		statusText: 'Unauthorized',
		headers: {
			'WWW-Authenticate': 'Basic realm="Restricted Area"'
		}
	})

	#credentials: Credentials[]
	#unauthorizedEntrypoint?: UIX.Entrypoint

	constructor(credentials: Credentials[], authorizedEntrypoint?: UIX.Entrypoint, unauthorizedEntrypoint?: UIX.Entrypoint) {
		super(authorizedEntrypoint);
		this.#credentials = credentials;
		this.#unauthorizedEntrypoint = unauthorizedEntrypoint;
	}
	
	intercept(_route: Path, context: UIX.Context) {
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