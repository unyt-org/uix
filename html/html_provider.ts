import type { TypescriptImportResolver } from "unyt_node/ts_import_resolver.ts";
import { Path } from "unyt_node/path.ts";
import { App, normalized_app_options } from "../app/app.ts";

/**
 * base class for frontendmanager, can be used as standlone provider to generate HTML Pages
 */
export class HTMLProvider {
	live: boolean;
	app_options: normalized_app_options
	import_resolver: TypescriptImportResolver
	scope:Path
	base_path:Path

	constructor(scope:Path, app_options:normalized_app_options, import_resolver:TypescriptImportResolver, live:boolean, base_path:Path) {
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
			return App.filePathToWebPath(resolved);
		}
		
		else return resolved
	}

	getRelativeImportMap() {
		const import_map = {imports: {...this.app_options.import_map.static_imports}};

		for (const [key, value] of Object.entries(import_map.imports)) {
			import_map.imports[key] = App.filePathToWebPath(value);
		}

		return import_map;
	}
}