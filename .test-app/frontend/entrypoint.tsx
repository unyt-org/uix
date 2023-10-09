import { testComponents } from "../common/test-components.tsx";
import { invalid } from "../common/errors.tsx";
import { HTTPError } from "uix/html/http-error.ts";
import { HTTPStatus } from "uix/html/http-status.ts";
import { HelloComponent } from "../common/HelloComponent.tsx";
import { Entrypoint } from "uix/html/entrypoints.ts";
import { renderStatic } from "uix/html/render-methods.ts";
import { logger } from "uix/utils/global_values.ts";
import { bindToOrigin } from "uix/utils/datex_over_http.ts";

const count = $$(0);

const el = await lazyEternal ?? $$(
	<button onclick={() => using (count) && count.val++}>
		Increase Counter (Current: {count})
	</button>
);

/* <button onclick={(() => count.val++).inDisplayContext.with({count})}>Increase Counter</button> */
/* <button onclick={(() => count.val++).with({count})}>Increase Counter</button> */

const comp = await lazyEternalVar('comp') ?? $$(<HelloComponent name="World42"/>);


logger.info("comp", comp)
logger.info("el", el)

export default {
	'/:component/frontend': (ctx, {component}) => testComponents[component as keyof typeof testComponents] || new HTTPError(HTTPStatus.NOT_FOUND),
	'/:component/backend*': null,
	'/x/*': {
		'/lazy': () => import("./lazy.tsx"),
		'/persistent': () => comp,
		'/persistent2': () => el
	},

	'frontendError': (ctx) => {
		throw new Error("This is an example error");
	},

	// set and get shared data on the frontend, available on the frontend + backend
	'setSharedValueFrontend/:key/:val': (async (ctx, {key, val}) => {
		const sharedData = await ctx.getSharedData()
		sharedData[key] = val;
		return renderStatic(`${key}=${val}`)
	}),

	'getSharedValueFrontend/:key': (async (ctx, {key}) => {
		const sharedData = await ctx.getSharedData()
		const val = sharedData[key];
		return renderStatic(`${key}=${val}`)
	}),


	'*': invalid
} satisfies Entrypoint;