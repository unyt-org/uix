import { Pointer, Ref, Value } from "datex-core-legacy/runtime/pointers.ts";

export function serializeJSValue(val:any):string {
	let serialized = JSON.stringify(val);

	// create mock pointer for type compatibility
	if (val instanceof Pointer) {
		serialized = `new Proxy({}, {
			set() {
				throw new Error("No DATEX Runtime loaded, ref is readonly")
			},
			get(t, p) {
				if (p == "val") return ${serialized};
				else throw new Error("No DATEX Runtime loaded, ref property '" + p + "' not supported")
			}
		})`
	}

	// is object and has prototype
	else if (val !== null && typeof val == "object" && !(val instanceof Array) && Object.getPrototypeOf(val) !== Object.prototype) {
		const proto = serializeJSValue(Object.getPrototypeOf(val));
		serialized = `{"__proto__":${proto}, ${serialized.slice(1)}`
	}

	return serialized;
}

export function getJSONCompatibleSerializedValue(value: any) {
	if (typeof value == "object") {
		if (value instanceof Ref) return {val: value.val}

		const newValue:Record<string,any>|any[] = value instanceof Array ? [] : {};
	
		if (!(value instanceof Array) && Object.getPrototypeOf(value) !== Object.prototype) {
			value.__proto__ = Object.getPrototypeOf(value);
		}

		for (const key of Object.keys(value)) {
			newValue[key as keyof typeof newValue] = normalizeValue(value[key]);
		}

		return newValue;
	}

	return value;
}