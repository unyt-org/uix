export function serializeJSValue(val:any):string {
	const serialized = JSON.stringify(val);

	// is object and has prototype
	if (typeof val == "object" && !(val instanceof Array) && Object.getPrototypeOf(val) !== Object.prototype) {
		const proto = serializeJSValue(Object.getPrototypeOf(val));
		return `{"__proto__":${proto}, ${serialized.slice(1)}`
	}
	else return serialized;
}