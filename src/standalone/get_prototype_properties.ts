import type { Class } from "datex-core-legacy/utils/global_types.ts";

/**
 * returns list of all property names and there corresponding value,
 * taking prototype overriding into account
 * @param clss class with prototypes
 * @returns 
 */
export function* getPrototypeProperties(clss: Class) {
	const usedKeys = new Set<string>();
	do {
		const proto=clss.prototype;
		if (!proto) return;
		for (const x of Object.getOwnPropertyNames(proto)) {
			if (!usedKeys.has(x)) {
				usedKeys.add(x);
				yield [x, proto[x]];
			}
		}
	} while ((clss=Object.getPrototypeOf(clss)) && clss != HTMLElement && clss != Object); // prototype chain
	return;
}


export const DISPOSE_BOUND_PROTOTYPE = Symbol("DISPOSE_BOUND_PROTOTYPE");

/**
 * Bind class prototoype to a value to act if the value was extending the class
 * @param value object
 * @param clss class with prototype
 */
export function bindPrototype(value:Record<string|symbol,unknown>, clss:Class) {
	const keys = new Set<string>()
	value[DISPOSE_BOUND_PROTOTYPE] = () => {
		const hasOnDisplay = !!keys.has("onDisplay");
		for (const k of keys) delete value[k];
		delete value[DISPOSE_BOUND_PROTOTYPE];
		return hasOnDisplay;
	}

	for (const [n,v] of getPrototypeProperties(clss)) {
		if (n == "constructor") continue;
		value[n] = v.bind(value);
		keys.add(n)
	}

}