import type { Class } from "unyt_core/utils/global_types.ts";

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

/**
 * Bind class prototoype to a value to act if the value was extending the class
 * @param value object
 * @param clss class with prototype
 */
export function bindPrototype(value:Record<string|symbol,unknown>, clss:Class) {
	for (const [n,v] of getPrototypeProperties(clss)) {
		value[n] = v.bind(value);
	}
}