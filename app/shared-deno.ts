export const sharedDeno = $$({} as any);

// TODO improve custom Deno mapping
for (const [key, value] of Object.entries(globalThis.Deno)) {
	sharedDeno[key] = value;
}