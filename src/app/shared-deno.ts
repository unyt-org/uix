/**
 * Reference to the globalThis.Deno object that 
 * can be accessed on the frontend when enabled (expose_deno set in app.dx)
 */
export const sharedDeno = $$({} as any);

// TODO improve custom Deno mapping
for (const [key, value] of Object.entries(globalThis.Deno)) {
	sharedDeno[key] = value;
}