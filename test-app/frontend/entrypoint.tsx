import { UIX } from "uix";
import { testComponents } from "../common/test-components.tsx";
import { invalid, notFound } from "../common/errors.tsx";


export default {
	'/:component/frontend': (ctx, {component}) => testComponents[component as keyof typeof testComponents] || notFound,
	'/:component/backend*': null,
	'/x/*': {
		'/lazy': () => import("./lazy.tsx")
	},

	'frontendError': (ctx) => {
		throw new Error("This is an example error");
	},

	'*': invalid
} satisfies UIX.Entrypoint;