
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