export function createStaticObject(val: unknown) {
	if (val && typeof val == "object") {
		for (const key of Object.keys(val)) {
			(val as any)[key] = createStaticObject((val as any)[key]);
		}
		Object.freeze(val)
	}
	return val;
}