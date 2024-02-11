import { Context } from "./context.ts";

export type filterFunction = (ctx: Context) => boolean|Promise<boolean>;
export type filter = symbol & {readonly __tag: unique symbol};

// TODO: use WeakMap when supported in Firefox
const filters = new Map<filter, filterFunction>()

/**
 * Creates a new filter that can be used as a key for route maps
 */
export function createFilter(filter: filterFunction, name?: string) {
	const filterSymbol = Symbol(name??filter.name??'anonymous route filter') as filter;
	filters.set(filterSymbol, filter);
	return filterSymbol;
}

export function evaluateFilter(filter: filter, ctx: Context) {
	const filterFunction = filters.get(filter);
	if (!filterFunction) return false; // TODO: throw error (problem with DX_PTR and other symbols)
	// if (!filterFunction) throw new Error("Invalid symbol as route map key ('"+filter.description+"') - not a registered filter. Use createFilter()");
	return filterFunction(ctx);
}