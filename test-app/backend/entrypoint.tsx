import { UIX } from "uix";
import { testComponents } from "../common/testComponents.tsx";
import { invalid, notFound } from "../common/errors.tsx";

export default {
	'/:component/backend\\+dynamic' : ctx => UIX.renderDynamic(testComponents[ctx.match?.pathname.groups['component'] as keyof typeof testComponents] || notFound), 
	'/:component/backend\\+static'  : ctx => UIX.renderStatic(testComponents[ctx.match?.pathname.groups['component'] as keyof typeof testComponents] || notFound),
	'/:component/backend\\+hydrated': ctx => UIX.renderWithHydration(testComponents[ctx.match?.pathname.groups['component'] as keyof typeof testComponents] || notFound),
	'/:component/frontend': null,
	'*': invalid
} satisfies UIX.Entrypoint;