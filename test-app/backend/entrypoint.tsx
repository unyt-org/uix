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

	'setValue/:key/:val': async (ctx, {key, val}) => {
		(await ctx.getPrivateData())[key] = val;
		console.log("set value", key,val)
		return UIX.renderStatic(`${key}=${val}`)
	},
	'getValue/:key': async (ctx, {key}) => {
		const val = (await ctx.getPrivateData())[key];
		return UIX.renderStatic(`${key}=${val}`)
	},

	'*': invalid
} satisfies UIX.Entrypoint;