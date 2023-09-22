import { Path } from "../utils/path.ts";
import { app } from "./app.ts";
import { UIX_CACHE_PATH } from "../utils/constants.ts";
import { Datex } from "unyt_core/datex.ts";
import { normalizedAppOptions } from "./options.ts";

/**
 * Resolves file paths to web paths, keeps everything else (web urls, import aliases)
 * @param filePath file path (e.g. "file://", "./xy", "/xy")
 * @returns web path (e.g. "/@uix/src/xy", "https://example.com/x")
 */
export function convertToWebPath(filePath:URL|string, includeDefaultDomain = false){
	// keep import aliases
	if (typeof filePath == "string" && !(filePath.startsWith("./")||filePath.startsWith("../")||filePath.startsWith("/")||filePath.startsWith("file://"))) return filePath;

	// route path
	if (filePath instanceof URL && filePath.protocol == Path.RouteProtocol) return new Path(filePath).routename

	// already a web path
	if (Path.pathIsURL(filePath) && new Path(filePath).is_web) return filePath.toString();

	if (!app.base_url) throw new Error("Cannot convert file path "+filePath+" to web path - no base file path set");
	const path = new Path(filePath, app.base_url);

	// is /@uix/cache
	if (path.isChildOf(UIX_CACHE_PATH)) return (includeDefaultDomain ? getDefaultDomainPrefix() : '') + path.getAsRelativeFrom(UIX_CACHE_PATH).replace(/^\.\//, "/@uix/cache/");
	// is /@uix/src
	else return (includeDefaultDomain ? getDefaultDomainPrefix() : '') + path.getAsRelativeFrom(app.base_url).replace(/^\.\//, "/@uix/src/")
}


export function getDefaultDomainPrefix() {
	return Datex.Unyt.endpointDomains()[0] ?? '';
}


export function getDirType(appOptions:normalizedAppOptions, path:Path) {	
	// backend path?
	for (const backend of appOptions.backend) {
		if (path.isChildOf(backend)) return 'backend'
	}

	// frontend path?
	for (const frontend of appOptions.frontend) {
		if (path.isChildOf(frontend)) return 'frontend'
	}

	// common path?
	for (const common of appOptions.common) {
		if (path.isChildOf(common)) return 'common'
	}
}