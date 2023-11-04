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

		
	/**
	 * scopes property of the import map
	 */
	get scopes(){return this.#json.scopes}

	toString(onlyImports = false) {
		return JSON.stringify(onlyImports ? {imports:this.imports, scopes: this.scopes} : this.#json, null, '    ')
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
	#json: {imports:Record<string,string>, scopes?:Record<string,Record<string,string>>};
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

	public addEntry(name:string|URL, value:string|URL, temporary = true, scope?: string|URL){
		if (this.readonly) {
			logger.warn("cannot dynamically update the current import map - no read access");
			return;
		}
		const val_string = this.getNormalizedURL(value);
		const name_string = this.getNormalizedURL(name);
		const scope_string = scope && this.getNormalizedURL(scope);
		
		// also add entries for aliases, e.g. for ./backend/x.dx -> backend/x.dx
		const namePath = name instanceof URL ? new Path(name) : null;
		if (namePath && !namePath.isWeb()) {
			for (const alias of this.getPathAliases(namePath)) {
				this.#addEntry(alias, val_string, temporary, scope_string);
			}
		}
		this.#addEntry(name_string, val_string, temporary, scope_string);

		this.#writeToFile();
	}

	public removeEntry(name: string|Path, temporary = true, scope?:string|"*"|URL) {
		if (this.readonly) {
			logger.warn("cannot dynamically update the current import map - no read access");
			return;
		}
		const name_string = this.getNormalizedURL(name);
		const scope_string = scope && this.getNormalizedURL(scope);

		// also remove entries for aliases, e.g. for ./backend/x.dx -> backend/x.dx
		const namePath = name instanceof URL ? new Path(name) : null;
		if (namePath instanceof Path && !namePath.isWeb()) {
			for (const alias of this.getPathAliases(namePath)) {
				this.#removeEntry(alias, temporary, scope_string);
			}
		}
		this.#removeEntry(name_string, temporary, scope_string);
		this.#writeToFile();
	}

	private getNormalizedURL(urlOrSpecifier:string|URL) {
		if (urlOrSpecifier instanceof URL) urlOrSpecifier = new Path(urlOrSpecifier);
		return (urlOrSpecifier instanceof Path && !urlOrSpecifier.isWeb()) ? urlOrSpecifier.getAsRelativeFrom(this.#path!) : urlOrSpecifier.toString();
	}

	public isEntryTemporary(name:string) {
		return this.#temporary_imports.has(name);
	}


	getPathAliases(path:Path) {
		const aliases = [];
		if (!this.#path) throw new Error("cannot resolve relative imports - no import map path")
		for (const [specifier, mapped] of Object.entries(this.imports)) {
			const mapped_path = new Path(mapped, this.#path);
			if (Path.equals(path, mapped_path) || path.isChildOf(mapped_path)) {
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


	#addEntry(name:string, value:string, temporary = true, scope?: string) {
		if (scope) {
			if (!this.scopes) this.#json.scopes = {};
			if (!(scope in this.scopes!)) this.scopes![scope] = {};
			this.scopes![scope][name] = value;
		}
		else this.imports[name] = value;
		if (temporary) this.#temporary_imports.add(name)
		logger.debug(`added${temporary?' temporary' : ''} entry: ${name}`)
	}

	#removeEntry(name:string, temporary = true, scope?: string) {
		if (scope == "*") {
			for (const scope of Object.values(this.scopes??{})) {
				delete scope[name]
			}
		}
		else if (scope) {
			delete this.scopes?.[scope]?.[name];
		}
		else delete this.imports[name];

		if (temporary) this.#temporary_imports.add(name)
		logger.debug(`removed${temporary?' temporary' : ''} entry: ${name}`)
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

