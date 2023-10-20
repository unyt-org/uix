import { testComponents } from "../common/test-components.tsx";
import { invalid } from "../common/errors.tsx";
import { HTTPError } from "uix/html/http-error.ts";
import { HTTPStatus } from "uix/html/http-status.ts";
import { Entrypoint } from "uix/html/entrypoints.ts";
import { renderBackend } from "uix/base/render-methods.ts";



export default {
	'/:component/frontend': (ctx, {component}) => testComponents[component as keyof typeof testComponents] || new HTTPError(HTTPStatus.NOT_FOUND),
	'/:component/static': null,
	'/:component/backend': null,
	'/:component/hydrated': null,

	'/x/*': {
		'/lazy': () => import("./lazy.tsx")
	},

	'frontendError': (ctx) => {
		throw new Error("This is an example error");
	},

	// set and get shared data on the frontend, available on the frontend + backend
	'setSharedValueFrontend/:key/:val': (async (ctx, {key, val}) => {
		const sharedData = await ctx.getSharedData()
		sharedData[key] = val;
		return renderBackend(`${key}=${val}`)
	}),

	'getSharedValueFrontend/:key': (async (ctx, {key}) => {
		const sharedData = await ctx.getSharedData()
		const val = sharedData[key];
		return renderBackend(`${key}=${val}`)
	}),


	'*': invalid
} satisfies Entrypoint;