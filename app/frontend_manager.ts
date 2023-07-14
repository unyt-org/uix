import { TypescriptTranspiler } from "unyt_node/ts_transpiler.ts";
import { TypescriptImportResolver } from "unyt_node/ts_import_resolver.ts";

import { $$, Datex } from "unyt_core";
import { Server } from "unyt_node/server.ts";
import { UIX } from "../uix.ts";
import { ALLOWED_ENTRYPOINT_FILE_NAMES, getDirType, normalized_app_options, validateDirExists } from "./app.ts";
import { generateDTS, generateTS } from "./interface_generator.ts";
import { Path } from "unyt_node/path.ts";
import { BackendManager } from "./backend_manager.ts";
import { getExistingFile, getExistingFileExclusive } from "../utils/file_utils.ts";
import { logger } from "../utils/global_values.ts";
import { generateHTMLPage } from "../html/render.ts";
import { HTMLProvider } from "../html/html_provider.ts";
const {serveDir} = globalThis.Deno ? (await import("https://deno.land/std@0.164.0/http/file_server.ts")) : {serveDir:null};

import { UIX_CACHE_PATH } from "../utils/constants.ts";
import { getGlobalStyleSheetLinks } from "../utils/css_style_compat.ts";
import { provideError, provideValue } from "../html/rendering.ts";

export class FrontendManager extends HTMLProvider {

	srcPrefix = "/@uix/src/"
	externalPrefix = "/@uix/external/"
	debugPrefix = "/@uix/debug/"

	srcPrefixRegex = String.raw `\/@uix\/src\/`

	constructor(app_options:normalized_app_options, scope:URL, base_path:URL, backend?:BackendManager, watch = false, live = false) {
		validateDirExists(scope, 'frontend');

		const scopePath = new Path(scope);
		const basePath = new Path(base_path);

		const import_resolver = new TypescriptImportResolver(scopePath, {
			import_map: app_options.import_map,
			import_map_base_path: basePath,
			interface_extensions: ['.dx', '.dxb'],
			interface_prefixes: ['@'],
			handle_out_of_scope_path: (path: Path|string, from:Path, imports:Set<string>, no_side_effects:boolean, compat:boolean) => this.handleOutOfScopePath(path, from, imports, no_side_effects, compat)
		});

		super(scopePath, app_options, import_resolver, live, basePath)

		this.#base_path = basePath;
		this.#web_path = new Path(`uix://${this.srcPrefix}${this.scope.name}/`);
		this.#backend = backend;
		this.#watch = watch;
		this.#logger = new Datex.Logger("UIX Frontend");

		if (this.app_options.offline_support) this.#client_scripts.push('uix/app/client_sw.ts');

		this.initFrontendDir();
		this.intCommonDirs();
		this.initServer();
		this.updateCheckEntrypoint();

		// generate entrypoint.ts interface for backend
		if (this.#backend?.web_entrypoint && this.#backend.entrypoint) this.handleOutOfScopePath(this.#backend.entrypoint, this.scope, new Set(["*"]), false, true);
		// bind virtual backend entrypoint
		if (this.#backend?.web_entrypoint && this.#backend?.virtualEntrypointContent) {
			const path = this.resolveImport(this.#backend?.web_entrypoint);
			//console.log("PATH:" + this.resolveImport(this.#backend?.web_entrypoint))
			this.server.path(path, this.#backend.virtualEntrypointContent, 'text/javascript')
		}
	}

	initFrontendDir(){
		this.transpiler = new TypescriptTranspiler(this.scope, {
			watch: this.#watch,
			import_resolver: this.import_resolver,
			on_file_update: this.#watch ? ()=>this.handleFrontendReload() : undefined
		});
	}


	intCommonDirs() {
		for (const common_dir of this.app_options.common) {
			const transpiler = new TypescriptTranspiler(new Path(common_dir), {
				dist_parent_dir: this.transpiler.tmp_dir,
				watch: this.#watch,
				import_resolver:  new TypescriptImportResolver(new Path(common_dir), {
					import_map: this.app_options.import_map,
					import_map_base_path: this.#base_path,
					handle_out_of_scope_path: (path: Path|string, from:Path, imports:Set<string>, no_side_effects:boolean, compat:boolean) => this.handleOutOfScopePath(path, from, imports, no_side_effects, compat)
				}),
				on_file_update: this.#watch ? ()=>{
					if (this.#backend?.watch) this.#backend.restart();
					this.handleFrontendReload();
				} : undefined
			})
			this.#common_transpilers.set(common_dir.toString(), [transpiler, this.srcPrefix + new Path(common_dir).name + '/'])

		}
	}

	initServer() {
		const transpilers:Record<string,TypescriptTranspiler> = {}

		// set common transpilers to @... web paths
		for (const [_path, [transpiler, web_path]] of this.#common_transpilers) {
			transpilers[web_path] = transpiler
		}

		// set default compiler to root web path
		transpilers['/'] = this.transpiler

		this.server = new Server(this.scope, {
			resolve_index_html: false,
			cors: true,
			transpilers
		});
	}

	updateCheckEntrypoint(){
		try {
			const entrypoint_path = getExistingFileExclusive(this.scope, ...ALLOWED_ENTRYPOINT_FILE_NAMES);

			if (entrypoint_path) {
				this.#entrypoint = this.#web_path.getChildPath(new Path(entrypoint_path).name);
			}
			// no entrypoint, but pages directory mapping
			else if (this.app_options.pages) {
				this.#entrypoint = this.#web_path.getChildPath("entrypoint.ts"); // virtual entrypoint, has no corresponding file in backend dir
				const path = this.resolveImport(this.#entrypoint);
				console.log("FRONTEND PATH:" + path)
				this.transpiler.addVirtualFile(path, `import { UIX } from "uix"; export default new UIX.PageProvider("../pages/");`, true)
			}

		}
		catch {
			logger.error("Only one of the following entrypoint files can exists in a directory: " + ALLOWED_ENTRYPOINT_FILE_NAMES.join(", "));
		}
	}


	getEntrypointCSS(){
		const entrypoint_css_path = getExistingFile(this.scope, "entrypoint.css", "entrypoint.scss");
		return entrypoint_css_path ? this.#web_path.getChildPath(new Path(entrypoint_css_path).getWithFileExtension("css").name) : undefined;
	}

	#BLANK_PAGE_URL = 'uix/base/blank.ts';

	server!: Server
	transpiler!: TypescriptTranspiler

	#common_transpilers = new Map<string, [transpiler:TypescriptTranspiler, web_path:string]>();

	#watch = false;

	#logger: Datex.Logger


	#backend?: BackendManager
	#base_path!:Path
	#web_path!: Path
	#entrypoint?: Path


	#client_scripts:(URL|string)[] = [
		'uix/app/client_default.ts'
	]


	async run(){

		if (this.server.running) return;

		// bind /@uix/frontend to scope
		this.server.path(new RegExp(String.raw `^${this.srcPrefixRegex}${this.scope.name}\/.*`), (req, path)=>{
			return path.replace(this.#web_path.pathname, '/');
		});

		// handled default web paths
		this.server.path("/", (req, path, con)=>this.handleIndexHTML(req, path, con));
		this.server.path("/favicon.ico", (req, path)=>this.handleFavicon(req, path));
		this.server.path("/robots.txt", (req, path)=>this.handleRobotsTXT(req, path));

		this.server.path(/^\/@uix\/cache\/.*$/, async (req, path)=>{
			await req.respondWith(await serveDir!(req.request, {fsRoot:UIX_CACHE_PATH.pathname, urlRoot:'@uix/cache/', enableCors:true, quiet:true}))
		});

		this.server.path("/@uix/window", (req, path)=>this.handleNewHTML(req, path));
		if (this.app_options.installable) this.server.path("/manifest.json", (req, path)=>this.handleManifest(req, path));
		this.server.path("/@uix/sw.js", (req, path)=>this.handleServiceWorker(req, path));
		this.server.path("/@uix/sw.ts", (req, path)=>this.handleServiceWorker(req, path));

		// handle datex-via-http
		this.server.path(/^\/@uix\/datex\/.*$/, async (req, path)=>{
			try {
				const dx = decodeURIComponent(path.replace("/@uix/datex/", ""));
				// TODO: rate limiting
				console.log("datex-via-http:",dx);

				const res = await Datex.Runtime.executeDatexLocally(dx, undefined, {from:Datex.BROADCAST});
				req.respondWith(await provideValue(res, {type:Datex.FILE_TYPE.JSON}));
			}
			catch (e) {
				req.respondWith(await provideError("DATEX Error: " + e));
			}
		});


		// handle routes (ignore /@uix/.... .dx)
		this.server.path(/^((?!^(\/@uix\/|\/\.dx)).)*$/, (req, path, con)=>{
			this.handleIndexHTML(req, path, con)
		});


		await this.server.listen();

		if (this.live){
			await this.createLiveScript()
			this.handleFrontendReload() // reload frontends from before backend restart
		}
	}

	#backend_virtual_files = new Map<string, Map<string, Set<string>>>()

	// resolve oos paths from local (client side) imports - resolve to web (https) paths
	// + resolve .dx/.dxb imports
	// if no_side_effects is true, don't update any files
	private async handleOutOfScopePath(import_path:Path|string, module_path:Path, imports:Set<string>, no_side_effects:boolean, compat:boolean){
		
		if (typeof import_path == "string") return this.handleAtImport(import_path, module_path, imports, no_side_effects, compat);

		// map .dx -> .dx.ts
		let mapped_import_path = import_path;
		if (import_path.hasFileExtension("dx")) mapped_import_path = import_path.getWithFileExtension('dx.ts');
		else if (import_path.hasFileExtension("dxb")) mapped_import_path = import_path.getWithFileExtension('dxb.ts');

		// try {
		if (import_path.fs_exists && !import_path.fs_is_dir) {
			const import_type = getDirType(this.app_options, import_path);
			const module_type = getDirType(this.app_options, module_path);

			if (import_type == "backend") {
				const web_path = this.srcPrefix + mapped_import_path.getAsRelativeFrom(this.#base_path).slice(2) // remove ./
				const import_pseudo_path = this.scope.getChildPath(web_path);
				// const rel_import_pseudo_path = import_pseudo_path.getAsRelativeFrom(module_path.parent_dir);

				if (!no_side_effects) await this.updateBackendInterfaceFile(web_path, import_pseudo_path, import_path, module_path, imports);

				return web_path
			}
	
			else if (import_type == "common") {
				for (const [path, [transpiler, web_root_path]] of this.#common_transpilers) {
					if (import_path.isChildOf(path)) {
						const web_path = web_root_path + transpiler.getDistPath(import_path, false, false)?.getAsRelativeFrom(transpiler.dist_dir).slice(2);
						return web_path
					}
				}
			}
	
			else if (import_type == "frontend") {
				// only relevant for .dx files
				if (module_type == "frontend") {
					const rel_path = mapped_import_path.getAsRelativeFrom(module_path);
					if (!no_side_effects) await this.updateDxMapFile(import_path.getAsRelativeFrom(this.scope), mapped_import_path, import_path, compat);

					// add d.ts. TODO: fill with content
					if (!no_side_effects) {
						let dts = generateDTS(rel_path, rel_path, []);
						dts += "\n// TODO: convert static dx to d.ts";
						const actual_path = await this.transpiler.addVirtualFile(mapped_import_path.replaceFileExtension("ts", "d.ts"), dts, true);
						this.app_options.import_map.addEntry(import_path,actual_path);
					}
					
					return rel_path;
				}
				else if (module_type == "backend") {
					return "[ERROR: TODO resolve frontend paths from backend dir]"
				}
				// resolve from common
				else if (module_type == "common") {
					const web_path = this.srcPrefix + mapped_import_path.getAsRelativeFrom(this.#base_path).slice(2) // remove ./
					return web_path
				}

			}
	
			else {
				this.#logger.error("Could not resolve invalid out of scope path: " + import_path);
				return "[ERROR: server could not resolve path (outside of scope)]"
			}
		}

		return "[ERROR: invalid import path: "+import_path+"]"
		
		
		// } catch (e) {
		// 	return "[server error: "+e.message+"]"
		// }

	}


	private async handleAtImport(specifier:string, module_path:Path, imports:Set<string>, no_side_effects:boolean, compat:boolean) {

		const module_type = getDirType(this.app_options, module_path);

		if (module_type == "backend") {
			return "[TODO]"
		}

		else if (module_type == "common") {
			return "[TODO]"
		}

		else if (module_type == "frontend") {
			const escaped_specifier = specifier.replace(/[^A-Za-z0-9_\-.]/g, '_') + '.dx.ts';
			const web_path = this.externalPrefix + escaped_specifier;
			const import_pseudo_path = this.scope.getChildPath(web_path);

			if (!no_side_effects) this.createTypescriptInterfaceFiles(web_path, specifier, import_pseudo_path, module_path, imports);

			return web_path;
		}

		else {
			this.#logger.error("Could not resolve invalid prefixed import: " + specifier);
			return "[ERROR: server could not resolve prefixed import]"
		}
	}

	// TODO: currently only default import working
	private async updateDxMapFile(dx_import_relative:string, ts_map_path:Path, dx_import_path?:Path,  compat = false) {
		const content = `import "${this.resolveImport("unyt_core", compat)}";\nexport default await datex.get("${dx_import_relative}")` ;
		await this.transpiler.addVirtualFile(ts_map_path, content, true);

	}


	#update_backend_promise?: Promise<any>

	private async updateBackendInterfaceFile(web_path:string, import_pseudo_path:Path, import_path:Path, module_path:Path, imports:Set<string>) {

		await this.#update_backend_promise;
		let resolve_done: Function|undefined;
		this.#update_backend_promise = new Promise(resolve=>resolve_done=resolve)

		const module_path_string = module_path.toString();

		if (!this.#backend_virtual_files.has(web_path)) this.#backend_virtual_files.set(web_path, new Map())
		if (!this.#backend_virtual_files.get(web_path)!.has(module_path_string)) this.#backend_virtual_files.get(web_path)!.set(module_path_string, new Set())

		const used_imports = this.#backend_virtual_files.get(web_path)!;

		const combined_imports_before = <Set<string>> new Set([...used_imports.values()].reduce((a, c) => a.concat( <any>[...c] ), []))
		// update imports used by module
		this.#backend_virtual_files.get(web_path)!.set(module_path_string, imports)
		let new_combined_imports = <Set<string>> new Set([...used_imports.values()].reduce((a, c) => a.concat( <any>[...c] ), []))
		// check if imports changed:
	
		let changed = false;
		const removed = new Set();

		for (const import_before of combined_imports_before) {
			if (!new_combined_imports.has(import_before)) {changed = true; removed.add(import_before);} // removed import
		}
		for (const new_import of new_combined_imports) {
			if (!combined_imports_before.has(new_import)) changed = true; // added import
		}

		// expand *
		if (new_combined_imports.has("*")) new_combined_imports = await this.getAllExportNames(import_path);
		if (removed.has("*")) {
			removed.delete("*");
			const all_exports = await this.getAllExportNames(import_path)
			for (const imp of new_combined_imports) all_exports.delete(imp);
			for (const removed_exp of all_exports) removed.add(removed_exp);
		} 

		// imports changed, update file
		if (changed) {
			this.#logger.info(`exposed exports of ${this.getShortPathName(import_path)} have changed: ${new_combined_imports.size ? `\n#color(green)  + ${[...new_combined_imports].join(", ")}` :' '}${removed.size ? `\n#color(red)  - ${[...removed].join(", ")}` : ''}`)
			await this.createTypescriptInterfaceFiles(web_path, import_path, import_pseudo_path, module_path, new_combined_imports)
		}

		resolve_done?.();
	}

	// create ts + d.ts interface file for ts/dx/dxb file and try to update import map
	private async createTypescriptInterfaceFiles(web_path:string, import_path_or_specifier:Path|string, import_pseudo_path:Path, module_path:Path, imports:Set<string>){
		const {ts, dts} = await this.generateTypeScriptInterface(import_path_or_specifier, web_path.replace(new RegExp(String.raw`^${this.srcPrefixRegex}`), '').replace(/.dx.ts$/, '.dx').replace(/.dxb.ts$/, '.dxb'), module_path, imports);
		await this.transpiler.addVirtualFile(import_pseudo_path, ts, true);
		if (dts) {
			const actual_path = await this.transpiler.addVirtualFile(import_pseudo_path.replaceFileExtension("ts", "d.ts"), dts, true);
			this.app_options.import_map.addEntry(import_path_or_specifier,actual_path);
		}
	}

	private getShortPathName(path:Path) {
		return path.getAsRelativeFrom(this.scope.parent_dir).replace(/^\.\//, '')
	}
	

	/**
	 * generate TS source code with exported interfaces
	 * @param path_or_specifier module path to create interfaces for, or datex endpoint, ...
	 * @param exports exports to generate code for
	 * @param module_path module from which the interface is imported
	 * @returns 
	 */
	private async generateTypeScriptInterface(path_or_specifier:Path|string, web_path:string, module_path:Path, exports:Set<string>) {
		const is_dx = typeof path_or_specifier == "string" || path_or_specifier.hasFileExtension("dx", "dxb");

		// create ts
		if (is_dx) exports = new Set(['default', ...exports]); // add default for DATEX modules
		const ts = generateTS(web_path, path_or_specifier, await this.getModuleExports(path_or_specifier, module_path, exports));

		// create d.ts for dx file
		const dts = is_dx ? generateDTS(web_path, path_or_specifier, await this.getModuleExports(path_or_specifier, module_path, new Set(['default', ...await this.getAllExportNames(path_or_specifier)]))) : null;

		return {ts, dts};
	}

	// TODO: better solution (currently also targets other objects than uix default exports) exceptions for values that should not be converted to pointers when exported
	private dontConvertValueToPointer(name:string, value:any){
		return name == "default" && Datex.Type.ofValue(value) == Datex.Type.std.Object;
	}

	private async getModuleExports(path_or_specifier:Path|string, module_path:Path, exports:Set<string>) {
		const values:[string, unknown, boolean, boolean][] = [];

		try {
			const module = <any> await datex.get(path_or_specifier);
			const is_dx = typeof path_or_specifier == "string" || path_or_specifier.hasFileExtension("dx", "dxb");
		
			// add default export for imported dx
			const inject_default = exports.has("default") && is_dx;
	
			const dx_type = Datex.Type.ofValue(module)
			const module_is_collapsable_obj = dx_type == Datex.Type.std.Object
			
			if (module_is_collapsable_obj) {
				for (const exp of exports) {
					if (exp == "default" && inject_default) continue;
					const exists = !!exp && typeof module == "object" && exp in module;
					if (!exists) {
						if (typeof path_or_specifier == "string") this.#logger.error(this.getShortPathName(module_path) + ": '" + exp + "' is currently not a exported value in " + path_or_specifier)
						else this.#logger.error(this.getShortPathName(module_path) + ": '" + exp + "' is currently not a exported value in module " + this.getShortPathName(path_or_specifier) + " - backend restart might be required")
					}
					const val = module[exp];
					values.push([exp, val, exists, this.dontConvertValueToPointer(exp, val)]);
				}
			}
	
			if (inject_default) {
				values.push(["default", module, true, true]); // export default wrapper object, no pointer
			}
		}
		catch (e) {
			logger.error("error loading module:", e?.message??e);
		} // network error, etc.., TODO: show warning somewhere
		

		return values;
	}

	private async getAllExportNames(path:Path|string) {
		try {
			const module = await datex.get(path);
			const dx_type = Datex.Type.ofValue(module)
			const names = module && dx_type == Datex.Type.std.Object ? Object.keys(module) : [];
			return new Set(names);
		}
		catch { // network error, etc., TODO: warning somewhere
			return new Set<string>(); 
		}
	}

	// script for connecting frontend endpoint to UIX Provider endpoint
	private async createLiveScript() {
		if (!this.server) return;

		this.#logger.success("live frontend reloading enabled");
		const script = `
${"import"} {Datex, datex, $$} from "unyt_core";
${"import"} {UIX} from "uix";
const logger = new Datex.Logger("UIX Dev");
export const reload = $$(Datex.Function.createFromJSFunction(async function(){
	logger.info("Reload triggered");
	await UIX.ServiceWorker.clearCache();
	window.location.reload();
}));
try {
	await datex \`${Datex.Runtime.endpoint}::#public.provider.addReloadHandler(\${reload})\`;
}
catch {
	logger.warn("Could not enable live page reloads");
}
`
		await this.transpiler.addVirtualFile(this.debugPrefix.slice(1)+"live.ts", script);

		this.#client_scripts.push(this.debugPrefix+"live.ts")

	}

	#ignore_reload = false;

	private async handleFrontendReload(){
		if (!this.live) return;
		if (this.#ignore_reload) return;

		this.#ignore_reload = true;
		const promises = []
		for (const handler of [...reload_handlers]) {
			promises.push((async ()=>{
				try {
					await handler()
				}
				catch (e){
					reload_handlers.delete(handler);
				}
			})())
		}

		await Promise.all(promises)

		setTimeout(()=>this.#ignore_reload=false, 500); // wait some time until next update triggered

		setTimeout(()=>{
			if (reload_handlers.size) this.#logger.info("reloaded " + reload_handlers.size + " endpoint client" + (reload_handlers.size==1?'':'s'));
		}, 200); // wait some time until next update triggered
	}

	private getUIXContextGenerator(requestEvent: Deno.RequestEvent, path:string, conn:Deno.Conn){
		return ()=>{
			return new UIX.ContextBuilder()
				.setRequestData(requestEvent, path, conn)
				.build()
		}
	}


	private async handleIndexHTML(requestEvent: Deno.RequestEvent, path:string, conn:Deno.Conn) {
		const url = new Path(requestEvent.request.url);
		const pathAndQueryParameters = url.pathname + url.search;
		const compat = Server.isSafariClient(requestEvent.request);
		const lang = UIX.ContextBuilder.getRequestLanguage(requestEvent.request);
		try {
			this.updateCheckEntrypoint();
			const entrypoint_css = this.getEntrypointCSS();

			// TODO:
			// Datex.Runtime.ENV.LANG = lang;
			// await Datex.Runtime.ENV.$.LANG.setVal(lang);
			const [prerendered_content, render_method, open_graph_meta_tags] = await this.#backend?.getEntrypointHTMLContent(pathAndQueryParameters, lang, this.getUIXContextGenerator(requestEvent, path, conn)) ?? [];
			// serve raw content (Blob or HTTP Response)
			if (prerendered_content && render_method == UIX.RenderMethod.RAW_CONTENT) {
				if (prerendered_content instanceof Response) await requestEvent.respondWith(prerendered_content.clone());
				else await this.server.serveContent(requestEvent, typeof prerendered_content == "string" ? "text/plain;charset=utf-8" : (<any>prerendered_content).type, <any>prerendered_content);
			}

			// serve normal page
			else {
				await this.server.serveContent(
					requestEvent, 
					"text/html", 
					await generateHTMLPage(this, <string|[string,string]> prerendered_content, render_method, this.#client_scripts, ['uix/style/document.css', entrypoint_css, ...getGlobalStyleSheetLinks()], ['uix/style/body.css', entrypoint_css], this.#entrypoint, this.#backend?.web_entrypoint, open_graph_meta_tags, compat, lang),
					undefined, undefined,
					{
						'content-language': lang
					}
				);
			}
		} catch (e) {
			console.log(e)
			await this.server.sendError(requestEvent, 500);
		}
	}

	// html page for new empty pages (includes blank.ts)
	private async handleNewHTML(requestEvent: Deno.RequestEvent, _path:string) {
		const compat = Server.isSafariClient(requestEvent.request);
		await this.server.serveContent(requestEvent, "text/html", await generateHTMLPage(this, "", UIX.RenderMethod.DYNAMIC, [...this.#client_scripts, this.#BLANK_PAGE_URL], ['uix/style/document.css', ...getGlobalStyleSheetLinks()], ['uix/style/body.css'], undefined, undefined, undefined, compat));
	}

	private async handleServiceWorker(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			const path = new Path(this.resolveImport('uix/sw/sw.ts', true, false), this.base_path);
			await this.server.serveContent(requestEvent, "text/javascript", await path.getTextContent());
		} catch {
			await this.server.sendError(requestEvent, 500);
		}			
	}

	private async handleFavicon(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			const path = new Path(this.resolveImport(this.app_options.icon_path, true, false), this.base_path);
			await this.server.serveContent(requestEvent, "image/*", await path.getTextContent());
		} catch (e) {
			console.log(e)
			await this.server.sendError(requestEvent, 500);
		}			
	}

	private async handleRobotsTXT(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			await this.server.serveContent(requestEvent, "text/plain", "User-agent: *\nAllow: /");
		} catch (e) {
			console.log(e)
			await this.server.sendError(requestEvent, 500);
		}			
	}
	

	private async handleManifest(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			await this.server.serveContent(requestEvent, "application/json", JSON.stringify({
				"name": this.app_options.name,
				"description": this.app_options.description,
				"default_locale": "en",
				"version": this.app_options.version,
				"icons": [
				  {
					"src": this.resolveImport(this.app_options.icon_path),
					"sizes": "287x287",
					"type": "image/png"
				  }
				],
				"start_url": "/",
				"display": "standalone",
				"display_override": ["window-controls-overlay"],
				"theme_color": "#111111",
				"manifest_version": 2,
				"permissions": ["webNavigation", "unlimitedStorage"],
				
				"file_handlers": [
				  {
					"action": "/",
					"accept": {
					  "application/datex": ".dxb",
					  "text/datex": ".dx",
					  "application/json": ".json"
					},
					"icons": [
					  {
						"src": "https://dev.cdn.unyt.org/unyt_core/assets/square_dark_datex.png",
						"sizes": "600x600",
						"type": "image/png"
					  }
					],
					"launch_type": "single-client"
				  }
				]
			}));
		} catch {
			await this.server.sendError(requestEvent, 500);
		}			
	}

}



const reload_handlers = eternal ?? $$(new Set<()=>void>());

@endpoint class provider {
	@property static addReloadHandler(handler:()=>void) {
		reload_handlers.add(handler)
	}
}