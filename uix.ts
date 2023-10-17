// deno-lint-ignore-file no-namespace
// Global constants
import { Path } from "./src/utils/path.ts";
import { Datex } from "datex-core-legacy";


/**
 * get UIX cache path
 */
const _cacheDir = new Path<Path.Protocol.File, true>('./uix/', Datex.cache_path);

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
	export const isHeadless = Datex.client_type === "deno"
	export const cacheDir = _cacheDir;

}

// polyfills TODO: still required (saFarI?)
// if (!UIX.isHeadless) {
//     try {
//         await import("https://unpkg.com/construct-style-sheets-polyfill@3.1.0/dist/adoptedStyleSheets.js");
//     }
//     catch {}
// }

// create cache dir if not exists
if (UIX.isHeadless && !UIX.cacheDir.fs_exists) Deno.mkdirSync(_cacheDir, {recursive:true})
