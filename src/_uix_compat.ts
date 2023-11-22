// Usage:
// await import("uix/_uix_compat.ts")
// await _loadUIX()

globalThis._loadUIX = async () => {
	await import("uix");
}

