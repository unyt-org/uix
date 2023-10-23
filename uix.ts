// Global constants
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { getThemeManager } from "./src/base/theme-manager.ts";
import { UIX_COOKIE, setCookie } from "./src/session/cookies.ts";
import { Path } from "./src/utils/path.ts";
import { Datex } from "datex-core-legacy";
import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";


/**
 * get UIX cache path
 */
const cacheDir = new Path<Path.Protocol.File, true>('./uix/', cache_path);

/**
 * get version from ./version file
 */
let version = "beta";
try {
	version = (await new Path("../version", import.meta.url).getTextContent()).replaceAll("\n","");
}
catch {/*ignore*/}

export const UIX = {
	version,
	isHeadless: client_type === "deno",
	cacheDir,
	get Theme() {
		return getThemeManager()
	},
	get language() {
		return Datex.Runtime.ENV.LANG;
	},
	set language(lang: string) {
		Datex.Runtime.ENV.LANG = lang;
	}
}

if (client_type == "browser") {
	// update uix-language cookie (only works if runtime initialized!)
	Datex.Ref.observe(Datex.Runtime.ENV.$.LANG, lang => {
		setCookie(UIX_COOKIE.language, lang)
	})

	// make sure UIX theme manager is activated
	getThemeManager();

	// polyfills TODO: still required (saFarI?)
	try {
        await import("https://unpkg.com/construct-style-sheets-polyfill@3.1.0/dist/adoptedStyleSheets.js");
    }
    catch {}
}

// create cache dir if not exists
if (UIX.isHeadless && !UIX.cacheDir.fs_exists) Deno.mkdirSync(cacheDir, {recursive:true})

// @ts-ignore
globalThis.UIX = UIX;