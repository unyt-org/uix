// deno-lint-ignore-file no-namespace
// Global constants
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { Path } from "./utils/path.ts";
import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";


/**
 * get UIX cache path
 */
const _cacheDir = new Path<Path.Protocol.File, true>('./uix/', cache_path);

/**
 * get version from ./version file
 */
let _version = "beta";
try {
	_version = (await new Path("../version", import.meta.url).getTextContent()).replaceAll("\n","");
}
catch {/*ignore*/}


export namespace UIX {
	
	export const version = _version
	export const isHeadless = client_type === "deno"
	export const cacheDir = _cacheDir;

}

// polyfills
if (!UIX.isHeadless) await import("https://unpkg.com/construct-style-sheets-polyfill@3.1.0/dist/adoptedStyleSheets.js");

// create cache dir if not exists
if (UIX.isHeadless && !UIX.cacheDir.fs_exists) Deno.mkdirSync(_cacheDir, {recursive:true})
