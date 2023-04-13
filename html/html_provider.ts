import type { TypescriptImportResolver } from "unyt_node/ts_import_resolver.ts";
import { Path } from "unyt_node/path.ts";
import type { normalized_app_options } from "../app/app.ts";

/**
 * base class for frontendmanager, can be used as standlone provider to generate HTML Pages
 */
export class HTMLProvider {
	live: boolean;
	app_options: normalized_app_options
	import_resolver: TypescriptImportResolver
	scope:Path

	constructor(scope:Path, app_options:normalized_app_options, import_resolver:TypescriptImportResolver, live:boolean) {
		this.scope = scope;
		this.app_options = app_options;
		this.import_resolver = import_resolver;
		this.live = live;
	}

	resolveImport(path:string|URL, compat_import_map?:boolean):string {
		// uix:// paths are absolute web paths without a domain -> return absolute path without protocol
		if (path instanceof URL && path.protocol == "uix:") return path.pathname;
		// normal path or url
		return compat_import_map ? this.import_resolver.resolveImportSpecifier(path.toString(), this.scope) : path.toString()
	}

	getRelativeImportMap() {
		const import_map = {imports: {...this.app_options.import_map.static_imports}};

		for (const [key, value] of Object.entries(import_map.imports)) {
			import_map.imports[key] = this.import_resolver.resolveRelativeImportMapImport(value, this.scope);
		}

		return import_map;
	}
}