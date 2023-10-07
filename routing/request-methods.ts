import { Context } from "./context.ts";
import { createFilter } from "uix/routing/route-filter.ts";

export function contextMatchesRequestMethod(requestMethod:string, context: Context) {
	return context.request?.method === requestMethod;
}

export const RequestMethod = {
	POST: 		createFilter(ctx => contextMatchesRequestMethod("POST", ctx), "POST Request"),
	GET:  		createFilter(ctx => contextMatchesRequestMethod("GET", ctx), "GET Request"),
	PATCH: 		createFilter(ctx => contextMatchesRequestMethod("PATCH", ctx), "PATCH Request"),
	DELETE: 	createFilter(ctx => contextMatchesRequestMethod("DELETE", ctx), "DELETE Request"),
	PUT:  		createFilter(ctx => contextMatchesRequestMethod("PUT", ctx), "PUT Request"),
	OPTIONS:  	createFilter(ctx => contextMatchesRequestMethod("OPTIONS", ctx), "OPTIONS Request"),
	HEAD:  		createFilter(ctx => contextMatchesRequestMethod("HEAD", ctx), "HEAD Request"),
} as const;



