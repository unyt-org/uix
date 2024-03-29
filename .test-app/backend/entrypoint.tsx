import { testComponents } from "../common/test-components.tsx";
import { invalid } from "../common/errors.tsx";
import { HTTPError } from "uix/html/http-error.ts";
import { HTTPStatus } from "uix/html/http-status.ts";
import { Entrypoint } from "uix/html/entrypoints.ts";
import { renderHybrid, renderDynamic, renderStatic, renderBackend } from "uix/base/render-methods.ts";


import {counter} from "./counter.eternal.ts";

counter.val++;
console.log("COUNTER = " + counter)

export default {
	'/:component/dynamic' : (ctx, {component}) => renderDynamic(testComponents[component as keyof typeof testComponents] || new HTTPError(HTTPStatus.NOT_FOUND)), 
	'/:component/hybrid': (ctx, {component}) => renderHybrid(testComponents[component as keyof typeof testComponents] || new HTTPError(HTTPStatus.NOT_FOUND)),
	'/:component/backend': (ctx, {component}) => renderBackend(testComponents[component as keyof typeof testComponents] || new HTTPError(HTTPStatus.NOT_FOUND)),
	'/:component/static'  : (ctx, {component}) => renderStatic(testComponents[component as keyof typeof testComponents] || new HTTPError(HTTPStatus.NOT_FOUND)),
	'/:component/frontend': null,
	'/x/*': null,

	// set and get private data on the backend, associated with the current endpoint session
	'setPrivateValue/:key/:val': async (ctx, {key, val}) => {
		const privateData = await ctx.getPrivateData()
		privateData[key] = val;
		return renderStatic(`${key}=${val}`)
	},
	'getPrivateValue/:key': async (ctx, {key}) => {
		const privateData = await ctx.getPrivateData()
		const val = privateData[key];
		return renderStatic(`${key}=${val}`)
	},

	'/setSharedValueFrontend/*': null,
	'/getSharedValueFrontend/*': null,

	// set and get shared data on the backend, available on the frontend + backend
	'setSharedValueBackend/:key/:val': (async (ctx, {key, val}) => {
		const sharedData = await ctx.getSharedData()
		sharedData[key] = val;
		return renderStatic(`${key}=${val}`)
	}),

	'getSharedValueBackend/:key': (async (ctx, {key}) => {
		const sharedData = await ctx.getSharedData()
		const val = sharedData[key];
		return renderStatic(`${key}=${val}`)
	}),

	'*': invalid
} satisfies Entrypoint;