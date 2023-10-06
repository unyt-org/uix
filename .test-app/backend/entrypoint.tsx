import { UIX } from "uix";
import { testComponents } from "../common/test-components.tsx";
import { invalid } from "../common/errors.tsx";
import { HTTPError } from "uix/html/http-error.ts";
import { HTTPStatus } from "uix/html/http-status.ts";


export default {
	'/:component/backend\\+dynamic' : (ctx, {component}) => UIX.renderDynamic(testComponents[component as keyof typeof testComponents] || new HTTPError(HTTPStatus.NOT_FOUND)), 
	'/:component/backend\\+static'  : (ctx, {component}) => UIX.renderStatic(testComponents[component as keyof typeof testComponents] || new HTTPError(HTTPStatus.NOT_FOUND)),
	'/:component/backend\\+hydrated': (ctx, {component}) => UIX.renderWithHydration(testComponents[component as keyof typeof testComponents] || new HTTPError(HTTPStatus.NOT_FOUND)),
	'/:component/frontend': null,
	'/x/*': null,

	// set and get private data on the backend, associated with the current endpoint session
	'setPrivateValue/:key/:val': async (ctx, {key, val}) => {
		const privateData = await ctx.getPrivateData()
		privateData[key] = val;
		return UIX.renderStatic(`${key}=${val}`)
	},
	'getPrivateValue/:key': async (ctx, {key}) => {
		const privateData = await ctx.getPrivateData()
		const val = privateData[key];
		return UIX.renderStatic(`${key}=${val}`)
	},

	'/setSharedValueFrontend/*': null,
	'/getSharedValueFrontend/*': null,

	// set and get shared data on the backend, available on the frontend + backend
	'setSharedValueBackend/:key/:val': (async (ctx, {key, val}) => {
		const sharedData = await ctx.getSharedData()
		sharedData[key] = val;
		return UIX.renderStatic(`${key}=${val}`)
	}),

	'getSharedValueBackend/:key': (async (ctx, {key}) => {
		const sharedData = await ctx.getSharedData()
		const val = sharedData[key];
		return UIX.renderStatic(`${key}=${val}`)
	}),

	'*': invalid
} satisfies UIX.Entrypoint<{a:number}>;