import { UIX } from "uix";
import { testComponents } from "../common/test-components.tsx";
import { invalid } from "../common/errors.tsx";
import { HTTPError } from "uix/html/http-error.ts";
import { HTTPStatus } from "uix/html/http-status.ts";

export default {
	'/:component/frontend': (ctx, {component}) => testComponents[component as keyof typeof testComponents] || new HTTPError(HTTPStatus.NOT_FOUND),
	'/:component/backend*': null,
	'/x/*': {
		'/lazy': () => import("./lazy.tsx")
	},

	'frontendError': (ctx) => {
		throw new Error("This is an example error");
	},

	'*': invalid
} satisfies UIX.Entrypoint;