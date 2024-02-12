// Global constants
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { getThemeManager } from "./src/base/theme-manager.ts";
import { UIX_COOKIE, setCookie } from "./src/session/cookies.ts";
import { Path } from "./src/utils/path.ts";
import { Datex } from "datex-core-legacy/mod.ts";
import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";

/**
 * get UIX cache path
 */
const cacheDir = client_type == "deno" ? new Path<Path.Protocol.File, true>('./uix/', cache_path) : new Path<Path.Protocol.HTTP|Path.Protocol.HTTPS, true>('/@uix/cache/', location.origin);

/**
 * get version from ./version file
 */
let version = "beta";
try {
	version = (await import("./VERSION.ts")).default
}
catch {
	console.error("Could not determine DATEX version")
}

export const UIX = {
	version,
	get context() {
		return client_type === "deno" ? "backend" : "frontend";
	},
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
	try {
		Datex.Ref.observe(Datex.Runtime.ENV.$.LANG, lang => {
			setCookie(UIX_COOKIE.language, lang)
			document.documentElement?.setAttribute("lang", lang)
		})
	} catch (e) {
		console.error(e);
	}

	// make sure UIX theme manager is activated
	getThemeManager();
}

// create cache dir if not exists
if (UIX.context == "backend" && !UIX.cacheDir.fs_exists) Deno.mkdirSync(cacheDir, {recursive:true})

// @ts-ignore
globalThis.UIX = UIX;