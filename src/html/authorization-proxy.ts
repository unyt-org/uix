import { Context } from "../routing/context.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { Entrypoint, EntrypointProxy } from "../providers/entrypoints.ts";

export type Credentials = {
	username: string,
	password: string
}

export type AuthorizationOptions = 
	{
		type: "basic",
		credentials: Credentials[]
	} 
	| 
	{
		type: "bearer",
		tokens: string[]
	}


/**
 * Proxy for authorization with various authentication methods (Basic, Bearer, etc.)
 */
export class AuthorizationProxy extends EntrypointProxy {
	
	// basic login dialog
	static readonly BASIC_UNAUTHORIZED_RESPONSE = new Response("", {
		status: 401,
		statusText: 'Unauthorized',
		headers: {
			'WWW-Authenticate': 'Basic realm="Restricted Area"'
		}
	})

	static readonly UNAUTHORIZED_RESPONSE = new Response(JSON.stringify(
		{ error: "Unauthorized" }
	), {
		status: 401,
		statusText: 'Unauthorized',
		headers: {
			'Content-Type': 'application/json'
		}
	})
	

	redirect = undefined
	transform = undefined

	#authorizationOptions: AuthorizationOptions
	#unauthorizedEntrypoint?: Entrypoint

	constructor(authorizationOptions: AuthorizationOptions, authorizedEntrypoint?: Entrypoint, unauthorizedEntrypoint?: Entrypoint) {
		super(authorizedEntrypoint);
		this.#authorizationOptions = authorizationOptions;
		this.#unauthorizedEntrypoint = unauthorizedEntrypoint;
	}
	
	intercept(_route: Path, context: Context) {
		
		let authorized = false;

		if (this.#authorizationOptions.type === "basic") {
			authorized = this.authorizeBasic(context);
		}
		else if (this.#authorizationOptions.type === "bearer") {
			authorized = this.authorizeBearer(context);
		}

		// pass through if authorized
		if (authorized) return null;

		// return fallback entryoint if unauthorized
		if (this.#unauthorizedEntrypoint) return this.#unauthorizedEntrypoint;
		else {
			if (this.#authorizationOptions.type === "basic") {
				// ask for credentials
				return AuthorizationProxy.BASIC_UNAUTHORIZED_RESPONSE;
			}
			else {
				return AuthorizationProxy.UNAUTHORIZED_RESPONSE
			}
		}
	}

	authorizeBasic(context: Context) {
		if (this.#authorizationOptions.type !== "basic") return false;

		const credentials = context.request?.headers.get("Authorization");
		if (credentials) {
			const base64 = credentials.split(" ")[1];
			const [_username, _password] = atob(base64).split(":");
			for (const {username, password} of this.#authorizationOptions.credentials) {
				if (username === _username && password === _password) return true;
			}
		}
		return false;
	}

	authorizeBearer(context: Context) {
		if (this.#authorizationOptions.type !== "bearer") return false;

		const token = context.request?.headers.get("Authorization");
		if (token) {
			return this.#authorizationOptions.tokens.includes(token.replace("Bearer ", ""));
		}
		return false;
	}


}