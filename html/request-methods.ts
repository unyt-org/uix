import { Context } from "../base/context.ts";

export const RequestMethod = {
	POST: Symbol("POST"),
	GET: Symbol("GET"),
	PATCH: Symbol("PATCH"),
	DELETE: Symbol("DELETE"),
	PUT: Symbol("PUT"),
	OPTIONS: Symbol("OPTIONS"),
	HEAD: Symbol("HEAD")
} as const;


export type requestMethod = typeof RequestMethod[keyof typeof RequestMethod];

export function contextMatchesRequestMethod(requestMethod:requestMethod, context: Context) {
	return Object.values(RequestMethod).includes(requestMethod) && context.request?.method == requestMethod.description;
}