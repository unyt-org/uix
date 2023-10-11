import { testComponents } from "../common/test-components.tsx";
import { invalid } from "../common/errors.tsx";
import { HTTPError } from "uix/html/http-error.ts";
import { HTTPStatus } from "uix/html/http-status.ts";
import { HelloComponent } from "../common/HelloComponent.tsx";
import { Entrypoint } from "uix/html/entrypoints.ts";
import { renderStandalone } from "uix/html/render-methods.ts";
import { logger } from "uix/utils/global_values.ts";
import { bindToOrigin } from "uix/utils/datex_over_http.ts";
// import { counter } from "backend/counter.eternal.ts";

// /* <button onclick={(() => count.val++).inDisplayContext.with({count})}>Increase Counter</button> */
// /* <button onclick={(() => count.val++).with({count})}>Increase Counter</button> */
// console.log("COUNTER = " + counter)


export default {
	'/:component/frontend': (ctx, {component}) => testComponents[component as keyof typeof testComponents] || new HTTPError(HTTPStatus.NOT_FOUND),
	'/:component/backend*': null,
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
		return renderStandalone(`${key}=${val}`)
	}),

	'getSharedValueFrontend/:key': (async (ctx, {key}) => {
		const sharedData = await ctx.getSharedData()
		const val = sharedData[key];
		return renderStandalone(`${key}=${val}`)
	}),


	'*': invalid
} satisfies Entrypoint;