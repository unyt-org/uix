import { Path } from "../utils/path.ts";
import { Logger } from "unyt_core/utils/logger.ts";
const logger = new Logger("UIX Import Map");

/**
 * wrapper class around the import map object, with an optional linked path and helper methods
 */
export class ImportMap {

	/**
	 * the orignal import map json
	 */
	get json() {return this.#json}
	
	/**
	 * imports property of the import map
	 */
	get imports(){return this.#json.imports}

	toString(onlyImports = false) {
		return JSON.stringify(onlyImports ? {imports:this.imports} : this.#json, null, '    ')
	}

	/**
	 * imports without temporary imports
	 */
	get static_imports(){
		const imports = {...this.#json.imports};
		for (const key of Object.keys(imports)) {
			if (this.isEntryTemporary(key)) delete imports[key];
		}
		return imports;
	}


	#readonly = true;
	#json: {imports:Record<string,string>};
	#path?: Path;


	#temporary_imports = new Set<string>;

	get readonly() {return this.#readonly}
	get path() {return this.#path}

	static async fromPath(path:string|URL) {
		const map = JSON.parse(<string>await new Path(path).getTextContent());
		return new ImportMap(map, path);
	}

	constructor(map:{imports:Record<string,string>}, path?:string|URL) {
		this.#json = map;
		this.#path = path ? new Path(path) : undefined;
		this.#readonly = !this.#path || this.#path.is_web;

		this.clearEntriesForExtension(".dx.d.ts"); // remove temporarily created dx.d.ts entries from previous sessions
		addEventListener("unload", ()=>this.clearTemporaryEntries());
	}

	public addEntry(name:string|Path, value:string|Path, temporary = true){
		if (this.readonly) {
			logger.warn("cannot dynamically update the current import map - no read access");
			return;
		}
		const val_string = value.toString();
		const relative_name = name instanceof Path ? name.getAsRelativeFrom(this.#path!) : name;

		// also add entries for aliases, e.g. for ./backend/x.dx -> backend/x.dx
		if (name instanceof Path) {
			for (const alias of this.getPathAliases(name)) {
				this.#addEntry(alias, val_string, temporary);
			}
		}
		this.#addEntry(relative_name, val_string, temporary);

		this.#writeToFile();
	}

	public isEntryTemporary(name:string) {
		return this.#temporary_imports.has(name);
	}


	getPathAliases(path:Path) {
		const aliases = [];
		if (!this.#path) throw new Error("cannot resolve relative imports - no import map path")
		for (const [specifier, mapped] of Object.entries(this.imports)) {
			const mapped_path = new Path(mapped, this.#path);
			if (path.isChildOf(mapped_path)) {
				aliases.push(path.toString().replace(mapped_path.toString(), specifier))
			}
		}
		return aliases;
	}

	clearEntriesForExtension(ext:string){
		if (this.readonly) return;

		for (const [specifier, mapped] of Object.entries(this.imports)) {
			if (mapped.endsWith(ext)) delete this.imports[specifier];
		}
		this.#writeToFile();
	}

	// remove temporary entries
	clearTemporaryEntries() {
		if (this.readonly) return;

		logger.info("removing temporary import map entries")
		for (const specifier of this.#temporary_imports) {
			delete this.imports[specifier];
		}
		this.#writeToFile();
	}


	#addEntry(name:string, value:string, temporary = true) {
		this.imports[name] = value;
		if (temporary) this.#temporary_imports.add(name)
		logger.debug(`added${temporary?' temporary' : ''} entry: ${name}`)
	}

	#writeToFile(){
		if (!this.#path) throw new Error("import map is readonly")
		try {
			Deno.writeTextFileSync(this.#path.normal_pathname, this.toString())
		}
		catch {
			logger.error("could not update import map")
		}
	}
}