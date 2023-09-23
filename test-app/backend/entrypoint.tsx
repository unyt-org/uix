import { UIX } from "uix";
import { testComponents } from "../common/test-components.tsx";
import { invalid, notFound } from "../common/errors.tsx";


export default {
	'/:component/backend\\+dynamic' : ctx => UIX.renderDynamic(testComponents[ctx.match?.pathname.groups['component'] as keyof typeof testComponents] || notFound), 
	'/:component/backend\\+static'  : ctx => UIX.renderStatic(testComponents[ctx.match?.pathname.groups['component'] as keyof typeof testComponents] || notFound),
	'/:component/backend\\+hydrated': ctx => UIX.renderWithHydration(testComponents[ctx.match?.pathname.groups['component'] as keyof typeof testComponents] || notFound),
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