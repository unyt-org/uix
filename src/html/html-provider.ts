import type { TypescriptImportResolver } from "../server/ts-import-resolver.ts";
import { Path } from "../utils/path.ts";
import type { normalizedAppOptions } from "../app/options.ts";
import { convertToWebPath } from "../app/convert-to-web-path.ts";

/**
 * Standalone provider to generate HTML Pages
 */
export class HTMLProvider {
	live: boolean;
	app_options: normalizedAppOptions
	import_resolver: TypescriptImportResolver
	scope:Path.File
	base_path:Path.File

	constructor(scope:Path.File, app_options:normalizedAppOptions, import_resolver:TypescriptImportResolver, live:boolean, base_path:Path.File) {
		this.scope = scope;
		this.app_options = app_options;
		this.import_resolver = import_resolver;
		this.live = live;
		this.base_path = base_path;
	}

	resolveImport(path:string|URL, compat_import_map?:boolean, map_to_web_path = true):string {
		// uix:// paths are absolute web paths without a domain -> return absolute path without protocol
		if (path instanceof URL && path.protocol == "uix:") return path.pathname + path.search;
		// first try to resolve import specifiers
		const resolved = compat_import_map && !Path.pathIsURL(path) ? this.import_resolver.resolveImportSpecifier(path.toString(), this.base_path) : path.toString();
		// make sure all paths are converted to web paths
		if (map_to_web_path) {
			return convertToWebPath(resolved);
		}
		
		else return resolved
	}

	/**
	 * Resolves uix:// paths to file urls, resolves import specifiers to absolute url strings
	 * @param path
	 */
	resolveForBackend(path:string|URL):string {
		path = path.toString();
		if (path.startsWith("uix://")) path = new Path("." + path.replace("uix:///@uix/src",""), this.base_path).toString();
		return import.meta.resolve(path)
	}

	getRelativeImportMap() {
		const import_map = {imports: {...this.app_options.import_map.static_imports}};

		for (const [key, value] of Object.entries(import_map.imports)) {
			// make sure relative paths are converted to path relative to import map location
			if (value.startsWith("./") || value.startsWith("../")) {
				import_map.imports[key] = convertToWebPath(new Path(value, this.app_options.import_map.path));
			}
			else 
				import_map.imports[key] = convertToWebPath(value);
		}

		return import_map;
	}
}