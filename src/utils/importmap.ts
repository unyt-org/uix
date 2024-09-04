import { Path } from "datex-core-legacy/utils/path.ts";
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

	#pinnedVersions:Record<string,string> = {};
	#libVersions:Record<string,string|undefined> = {};

	/**
	 * imports without temporary imports
	 * pinned versions are resolved
	 */
	get static_imports(){
		const imports = {...this.#json.imports};
		for (const specifier of Object.keys(imports)) {
			// exclude .eternal.ts imports
			if (specifier.endsWith(".eternal.ts") || specifier.endsWith(".eternal.tsx") || specifier.endsWith(".eternal.js") || specifier.endsWith(".eternal.jsx") || specifier.endsWith(".eternal.mts") || specifier.endsWith(".eternal.mjs")) 
				delete imports[specifier];
			// exclude temp entries
			if (this.isEntryTemporary(specifier)) delete imports[specifier];
			// pinned versions
			if (specifier in this.#pinnedVersions) imports[specifier] = this.#pinnedVersions[specifier];
		}
		return imports;
	}

	/**
	 * resolves pinned versions (unyt CDNs)
	 */
	async resolvePinnedVersions() {
		for (const [specifier, url] of Object.entries(this.static_imports)) {
			// only if url
			if (typeof url == "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
				// get path (https://domain/path/VERSION.ts)
				const path = new Path(url);
				const lib = path.pathname.split("/")[1];
				if (!(lib in this.#libVersions)) {
					// get version from VERSION.ts module
					try {
						const versionPath = new Path(path.origin).getChildPath(lib + "/VERSION.ts");
						const version = (await import(versionPath.toString())).default;

						// ignore non-semver versions
						if (version.match(/\d+\.\d+\.\d+/)) {
							this.#libVersions[lib] = version;
							logger.debug("using pinned version " + version + " for " + lib);
						}
						else this.#libVersions[lib] = undefined;
					}
					catch {
						this.#libVersions[lib] = undefined;
					}
				} 

				// set pinned version for URL
				if (this.#libVersions[lib]) {
					this.#pinnedVersions[specifier] = url.replace(/(?<=https?:\/\/[^/]*\/)[^/]*/, (v)=> {
						return v.replace(/@.*/, '') + "@" + this.#libVersions[lib];
					})
				}
			}
		}
	}

	#initialized = false;
	async init() {
		if (this.#initialized) return;
		this.#initialized = true;
		await this.resolvePinnedVersions();
	}

	#readonly = true;
	#json: {imports:Record<string,string>, scopes?:Record<string,Record<string,string>>};
	#path?: Path;
	#originalPath?: Path


	#temporary_imports = new Set<string>;

	get readonly() {return this.#readonly}
	get path() {return this.#path}
	get originalPath() {return this.#originalPath??this.#path}

	static async fromPath(path:string|URL) {
		const map = JSON.parse(<string>await new Path(path).getTextContent());
		return new ImportMap(map, path);
	}

	constructor(map:{imports:Record<string,string>}, path?:string|URL, resetOnUnload = false, originalPath?:Path) {
		this.#json = map;
		this.#path = path ? new Path(path) : undefined;
		this.#originalPath = originalPath;
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
		return new ImportMap({imports:mappedImports}, newImportMapLocation, resetOnUnload, this.originalPath);
	}
}

