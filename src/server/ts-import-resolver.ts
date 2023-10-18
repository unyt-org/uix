import { Path } from "../utils/path.ts";
import { Logger } from "datex-core-legacy/utils/logger.ts";
import { getCallerDir } from "datex-core-legacy/utils/caller_metadata.ts";
import { ImportMap } from "../utils/importmap.ts";
import "datex-core-legacy/utils/auto_map.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";

const logger = new Logger("ts import resolver");

type oos_handler = (path_or_custom_specifier: Path.File|string, from:Path, imports:Set<string>, no_side_effects:boolean, compat:boolean)=>string|null|Promise<string|null>;

type importmap = {imports:Record<string,string>};

type import_resolver_options = {
    import_map?: ImportMap|importmap
    import_map_base_path?: Path // default is scope path of import resolver
    interface_extensions?: string[] // custom interface extensions that are handled in handle_out_of_scope_path
    interface_prefixes?: string[], // custom module prefixes that are handled in handle_out_of_scope_path
    handle_out_of_scope_path?: oos_handler // callback for out of scope import
}

export class TypescriptImportResolver {

	private static import_specifier_regex = client_type === "deno" ? new RegExp(String.raw`(?<=^(?:\*\/ *)?)((?:import|export)\s+(?:[A-Za-z0-9_$,{} ])*\s+from\s+|import\s+)["'](((?!\w+:\/\/)[^."'][^"']*)|[0-9A-Za-z_\-@:.]+)["']`, 'gm') : null // /(?<=^(?:\*\/ *)?)((?:import|export)\s+(?:[A-Za-z0-9_$,{} ])*\s+from\s+|import\s+)["'](((?!\w+:\/\/)[^."'][^"']*)|[0-9A-Za-z_\-@:.]+)["']/gm;
    private static general_import_regex   = client_type === "deno" ? new RegExp(String.raw`(?<=^(?:\*\/ *)?)((?:import|export)\s+((?:[A-Za-z0-9_$,{}* ]|["'](?:[^"']+)["'])*)\s+from\s+|import\s+)["']([^"']+)["']`, 'gm') : null // /(?<=^(?:\*\/ *)?)((?:import|export)\s+((?:[A-Za-z0-9_$,{}* ]|["']([^"']+)["'])*)\s+from\s+|import\s+)["']([^"']+)["']/gm

	readonly scope?: Path // root path for source files, locations outside have to be resolved with out of scope resolution
    readonly import_map_base_path?: Path // import map location

    import_map?:ImportMap;
    oos_handler?: oos_handler
    custom_extensions: string[]
    custom_prefixes: string[]

	constructor(scope?:Path|string, options:import_resolver_options = {}) {
        if (scope) scope = scope instanceof Path ? scope : new Path(scope, getCallerDir());

        if (!options.import_map_base_path) options.import_map_base_path = <Path>scope;
        if (!options.import_map) throw new Error("typescript import resolver currently requires an import map")

        this.import_map = options.import_map instanceof ImportMap ? options.import_map : (options.import_map ? new ImportMap(options.import_map) : undefined);
        this.import_map_base_path = options.import_map_base_path ?? this.import_map?.path;
		this.scope = <Path>scope;
        this.custom_extensions = options.interface_extensions ?? [];
        this.custom_prefixes = options.interface_prefixes ?? [];
        this.oos_handler = options.handle_out_of_scope_path;
	}

    /**
     * resolve import map relative path, relative to location of importmap
     */
    resolveRelativeImportMapImport(specifier:string, path:Path) {
        if (specifier.startsWith("./") || specifier.startsWith("../")) {
            return new Path(specifier, this.import_map_base_path).getAsRelativeFrom(path);
        }
        else return specifier;
    }

	resolveImportSpecifier(specifier:string, path:Path): string {

        // TODO: (wrong import mapping for /@uix/src web paths)
        // let resolved = import.meta.resolve(specifier);
        
        // is in datex_cache/eternal -> keep original specifier, eternal values on frontend are resolved by server, not import map

        if (!this.import_map) {
            logger.warn("cannot resolve imports, no import map")
            return specifier; // no import map, cannot resolve
        }


        // already resolved
        if (specifier.startsWith("../") || specifier.startsWith("./")) return specifier; // already a relative path
        else if (specifier.startsWith("/")) return specifier; // already an absolute path
        else if (specifier.startsWith("https://") || specifier.startsWith("http://")) return specifier; // already an absolute url path

        // TODO:?

        let resolved: string|undefined
        const imports = this.import_map.imports;

        // direct import identifier
        if (!specifier.includes("/") && imports[specifier] && !this.import_map.isEntryTemporary(specifier)) {
            resolved = imports[specifier];
        }
       
        // import identifier path
        else if (specifier.includes("/")) {

            // direct match
            if (imports[specifier] && !this.import_map.isEntryTemporary(specifier)) {
               resolved = imports[specifier];
            }
            // resolve path
            else {
                const parts = specifier.split("/");
                let prefix = "";
                for (let i = 0; i<parts.length-1; i++) {
                    prefix += parts[i] + "/";
                    if (imports[prefix]) {
                        resolved = imports[prefix] + parts.slice(i+1).join("/");
                    }
                }
            }
        }
        
        if (!resolved) {
            resolved = specifier;
            // ignored entry in import map, can be ignored?
            if (imports[specifier] && this.import_map.isEntryTemporary(specifier)) {}
            else logger.warn("Cannot resolve import '"+specifier+"'") // should not happen, but can ignore for now in workaround impl, because imports are resolved for all ts files in the source directory, even those without correct import map imports
        }

        // keep original specifier for eternal.ts
        if (resolved.endsWith(".eternal.ts") || resolved.endsWith(".eternal.tsx") || resolved.endsWith(".eternal.js") || resolved.endsWith(".eternal.jsx") || resolved.endsWith(".eternal.mts") || resolved.endsWith(".eternal.mjs")) 
            resolved = specifier

        return this.resolveRelativeImportMapImport(resolved, path);
	}

    /**
     * 
     * @param path ts/js file path
     * @param compat if true, resolve import specifiers via import map in file
     */
	public async resolveImports(path:Path, reference_path = path, compat = false, no_side_effects = false) {
        if (!path.fs_exists) {
            logger.warn("file does not exist: " + path);
            return;
        }
        
		await this.resolveOutOfScopeAndInterfaceImports(path, reference_path, no_side_effects, compat)
        if (compat) await this.resolveImportSpecifiers(path, reference_path); // resolve import specifiers if import map not supported
    }

	/**
	 * overrides the import statements in a js/ts file, mapping non-absolute or relative import specifiers (e.g. "uix") to absolute urls, according to the import map
	 */
	public async resolveImportSpecifiers(path:Path, reference_path = path) {
        if (!path.fs_exists) {
            logger.warn("file does not exist: " + path);
            return;
        }
		const content = await Deno.readTextFile(path.normal_pathname);

		const resolved_content = content.replace(TypescriptImportResolver.import_specifier_regex!, (_match: string, p1:string, import_specifier:string)=>{
            const resolved = this.resolveImportSpecifier(import_specifier, reference_path);
            return `${p1}"${resolved}"`
        });

		await Deno.writeTextFile(path.normal_pathname, resolved_content);
	}

    private currently_resolving = new Set<string>();
    private last_imported_for_path = new Map<string, Set<string>>().setAutoDefault(Set); // remember which module imported which module paths at last compilation time

    /**
     * Call handlers for imports that are not in the scope or imports with custom extension handling
     * @param path module path to resolve
     * @param reference_path path that should be passed on to the handlers as the 'fake' path of the module
     * @param no_side_effects passed on to the handlers, indicates that the out of scope imports can be acknowledges, but side effects (creating new files) should be avoied
     * This might be the case for TypeScript modules, if the corresponding JavaScript module is also resolved separately
     * @returns 
     */
	private async resolveOutOfScopeAndInterfaceImports(path:Path, reference_path = path, no_side_effects = false, compat = false) {
    	if (!this.scope) throw "no root scope specified for import resolver";
      
        // prevent multiple resolution side-by-side
        if (this.currently_resolving.has(path.toString())) return;
        this.currently_resolving.add(path.toString())

        if (!path.fs_exists) {
            logger.warn("file does not exist: " + path);
            return;
        }

        const content = await Deno.readTextFile(path.normal_pathname);

        const new_imported = new Set<string>();
        const replacers = new Map<string, Map<string,Set<string>>>().setAutoDefault(Map); // import path -> (key -> imports)
        const originalImportSpecifiers = new Map<string, string>()// import path -> original import specifier
        let counter = 0;

        // TODO: don't use replace, new_content is no longer used
        // resolve relative parent paths that are not in the scope of the served root directory
        let new_content = content.replace(TypescriptImportResolver.general_import_regex!, (match: string, p1:string, imports:string, specifier:string)=>{

            let is_prefix = false;
            for (const prefix of this.custom_prefixes) {
                if (specifier.startsWith(prefix)) {
                    if (!this.oos_handler) {
                        logger.error("could not resolve custom prefix (no handler): " + specifier);
                        return `${p1}"[could not resolve custom prefix]"`
                    }
                    is_prefix = true;
                }
            }

            const rel_import_path = is_prefix ? null : this.resolveImportSpecifier(specifier, reference_path)
            const abs_import_path = is_prefix ? null : new Path(rel_import_path!, reference_path);
        
            // workaround: ignore 'node:x' paths
            if (abs_import_path?.toString().startsWith("node:")) return match;

            // already resolved web path
            if (abs_import_path?.is_web) return match;

            const is_oos = !abs_import_path?.isChildOf(this.scope!);
            let is_ext = false;
            const imports_list = new Set<string>();

            for (const ext of this.custom_extensions) {
                if (abs_import_path?.filename.endsWith(ext)) {
                    if (!this.oos_handler) {
                        logger.error("could not resolve custom interface path (no handler): " + reference_path.normal_pathname);
                        return `${p1}"[could not resolve path]"`
                    }
                    is_ext = true;
                }
            }

            // custom extension and/or out of scope
            if (is_ext || is_oos || is_prefix) {

                if (!this.oos_handler) {
                    logger.error("could not resolve out of scope path (no handler): " + reference_path.normal_pathname);
                    return `${p1}"[could not resolve path]"`
                }

                // get imports
                if (imports) {

                    const [default_import, other_imports] = imports.split("{");
                    // has default import or * import
                    if (default_import.trim()) {
                        if (default_import.includes("*")) imports_list.add("*") // * import
                        if (default_import.includes(",") || !default_import.includes("*")) imports_list.add("default") // some sort of default import
                    } 

                    // extract imports
                    // {x, y as z, default as cc, 'some string' as someString} -> ["x","y", "default", "some string"]
                    if (other_imports) {
                        const parts = other_imports.replace("{","").replace("}","").split(",");
                        for (const part of parts) {
                            const imported = part.trim().split(" as ", 2)[0]?.trim();
                            if (imported) imports_list.add(imported.replace(/['"]/g,''));
                        }
                    }

                }

                // custom extension and/or out of scope
                const abs_import_path_string = abs_import_path?.toString() ?? '#prefix:' + specifier;
                new_imported.add(abs_import_path_string);
                const key = `\u001A\u001A${counter++}\u0007`;
                replacers.getAuto(abs_import_path_string)!.set(key, imports_list)
                originalImportSpecifiers.set(abs_import_path_string, specifier)

                return `${p1}"${key}"`;
            }

            // ok, don't change
            else return match;
        });

        if (this.oos_handler) {
            for (const [abs_import_path_or_prefix, data] of replacers) {
                const combined_imports_list = <Set<string>> new Set([...data.values()].reduce((a, c) => a.concat( <any>[...c] ), []))
                const rep_path = await this.oos_handler(abs_import_path_or_prefix.startsWith('#prefix:') ? abs_import_path_or_prefix.replace('#prefix:', '') : new Path(abs_import_path_or_prefix), reference_path, combined_imports_list, no_side_effects, compat);
                for (const key of data.keys()) {
                    new_content = new_content.replace(key, rep_path ?? originalImportSpecifiers.get(abs_import_path_or_prefix)!);
                }
            }

            // inform if import paths where completely removed
            const last_imported = this.last_imported_for_path.getAuto(path.toString())
            for (const last_imported_path of last_imported) {
                if (!new_imported.has(last_imported_path)) await this.oos_handler(last_imported_path.startsWith('#prefix:') ? last_imported_path.replace('#prefix:', '') : new Path(last_imported_path), reference_path, new Set(), no_side_effects, compat); // empty imports
            }
            this.last_imported_for_path.set(path.toString(), new_imported);
        }

        //await Deno.writeTextFile(path.normal_pathname, new_content);
        this.currently_resolving.delete(path.toString())
    }

    private async replaceAsync(string:string, regexp:RegExp, replacerFunction:(...ps:string[])=>Promise<string>) {
        const replacements = await Promise.all(
            Array.from(string.matchAll(regexp),
                (match) => replacerFunction(...match)));
        let i = 0;
        return string.replace(regexp, () => replacements[i++]);
    }
}