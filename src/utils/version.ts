import { getBaseDirectory } from "./uix-base-directory.ts";

/**
 * get version from ./version file
 */
let _version = "beta";
try {
	_version = (await import("../../VERSION.ts")).default
}
catch {
	console.error("Could not determine UIX version")
}
export const version = _version;



/**
 * returns true if running custom Deno for UIX build
 */
export function isDenoForUIX() {
	const baseDir = getBaseDirectory();
	// base directory includes .uix -> custom install
	return baseDir.pathname.includes(".uix");
}