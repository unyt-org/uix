import { Path } from "../utils/path.ts";
import { Logger } from "datex-core-legacy/utils/logger.ts";
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
			// exclude .eternal.ts imports
			if (key.endsWith(".eternal.ts") || key.endsWith(".eternal.tsx") || key.endsWith(".eternal.js") || key.endsWith(".eternal.jsx") || key.endsWith(".eternal.mts") || key.endsWith(".eternal.mjs")) 
				delete imports[key];
			// exclude temp entries
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

	constructor(map:{imports:Record<string,string>}, path?:string|URL, resetOnUnload = false) {
		this.#json = map;
		this.#path = path ? new Path(path) : undefined;
		this.#readonly = !this.#path || this.#path.is_web;

		this.clearEntriesForExtension(".dx.d.ts"); // remove temporarily created dx.d.ts entries from previous sessions
		if (resetOnUnload) addEventListener("unload", ()=>this.clearTemporaryEntries());

		// make imports available as normal property
		const descriptor = Object.getOwnPropertyDescriptor(ImportMap.prototype, "imports");
		const modified_descriptor = Object.assign(descriptor as any, {enumerable: true});
		Object.defineProperty(this, "imports", modified_descriptor);
	}

	public addEntry(name:string|Path, value:string|Path, temporary = true){
		if (this.readonly) {
			logger.warn("cannot dynamically update the current import map - no read access");
			return;
		}
		if (name instanceof URL) name = new Path(name);
		if (value instanceof URL) value = new Path(value);

		const val_string = (value instanceof Path && !value.isWeb()) ? value.getAsRelativeFrom(this.#path!) : value.toString();
		const name_string = (name instanceof Path && !name.isWeb()) ? name.getAsRelativeFrom(this.#path!) : name.toString();

		// also add entries for aliases, e.g. for ./backend/x.dx -> backend/x.dx
		if (name instanceof Path && !name.isWeb()) {
			for (const alias of this.getPathAliases(name)) {
				this.#addEntry(alias, val_string, temporary);
			}
		}
		this.#addEntry(name_string, val_string, temporary);

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
			Deno.writeTextFileSync(this.#path, this.toString())
		}
		catch {
			logger.error("could not update import map")
		}
	}

	save() {
		this.#writeToFile()
	}

	getMoved(newImportMapLocation: URL, resetOnUnload = false) {
		const mappedImports:Record<string,string> = {};
		for (let [key, value] of Object.entries(this.imports)) {
			if (key.startsWith("./") || key.startsWith("../")) {
				const absPath = new Path(key, this.path);
				key = absPath.getAsRelativeFrom(newImportMapLocation);
			} 
			if (value.startsWith("./") || value.startsWith("../")) {
				const absPath = new Path(value, this.path);
				value = absPath.getAsRelativeFrom(newImportMapLocation);
			}
			mappedImports[key] = value;
		}
		return new ImportMap({imports:mappedImports}, newImportMapLocation, resetOnUnload);
	}
}

