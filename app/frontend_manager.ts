import { TypescriptTranspiler } from "unyt_node/ts_transpiler.ts";
import { TypescriptImportResolver } from "unyt_node/ts_import_resolver.ts";

import { Datex } from "unyt_core";
import { Server } from "unyt_node/server.ts";
import { UIX } from "../uix.ts";
import { getDirType, normalized_app_options, validateDirExists } from "./app.ts";
import { generateMatchingJSValueCode } from "./interface_generator.ts";
import { Path } from "unyt_node/path.ts";

export class FrontendManager {

	constructor(app_options:normalized_app_options, scope:URL, base_path:URL, watch = false, live = false) {

		validateDirExists(scope, 'frontend');

		this.#scope = new Path(scope);
		this.#base_path = new Path(base_path);
		this.frontend_path = `/@${this.#scope.name}/`;

		this.#app_options = app_options;
		this.#live = live;
		this.#watch = watch;
		this.#logger = new Datex.Logger("UIX Frontend");
		this.#logger.success("init at " + this.#scope);

		if (this.#app_options.offline_support) this.#client_scripts.push('uix/app/client_sw.ts');

		this.initFrontendDir();
		this.intCommonDirs();
		this.initServer();
	}

	initFrontendDir(){
		this.import_resolver = new TypescriptImportResolver(this.#scope, {
			import_map: this.#app_options.import_map,
			import_map_base_path: this.#base_path,
			handle_out_of_scope_path: (path: Path, from:Path, imports:Set<string>, no_side_effects:boolean) => this.handleOutOfScopePath(path, from, imports, no_side_effects)
		});

		this.transpiler = new TypescriptTranspiler(this.#scope, {
			watch: this.#watch,
			import_resolver: this.import_resolver,
			on_file_update: this.#watch ? ()=>this.handleFrontendReload() : undefined
		});

	}


	intCommonDirs() {
		for (const common_dir of this.#app_options.common) {
			const transpiler = new TypescriptTranspiler(new Path(common_dir), {
				dist_parent_dir: this.transpiler.tmp_dir,
				watch: this.#watch,
				import_resolver:  new TypescriptImportResolver(new Path(common_dir), {
					import_map: this.#app_options.import_map,
					import_map_base_path: this.#base_path,
					handle_out_of_scope_path: (path: Path, from:Path, imports:string[], no_side_effects:boolean) => this.handleOutOfScopePath(path, from, imports, no_side_effects)
				}),
				on_file_update: this.#watch ? ()=>this.handleFrontendReload() : undefined
			})
			this.#common_transpilers.set(common_dir.toString(), [transpiler, '/@' + new Path(common_dir).name + '/'])

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

		this.server = new Server(this.#scope, {
			resolve_index_html: true,
			cors: true,
			transpilers
		});
	}


	#BLANK_PAGE_URL = 'uix/base/blank.ts';

	server!: Server
	transpiler!: TypescriptTranspiler
	import_resolver!: TypescriptImportResolver

	#common_transpilers = new Map<string, [transpiler:TypescriptTranspiler, web_path:string]>();

	#live = false;
	#watch = false;

	#logger: Datex.Logger


	#base_path!:Path
	#scope!:Path
	frontend_path!: string

	#app_options!:normalized_app_options

	#client_scripts:(URL|string)[] = [
		'uix/app/client_default.ts'
	]

	private resolveImport(path:string|URL, compat_import_map = false){
		return compat_import_map ? this.import_resolver.resolveImportSpecifier(path.toString(), this.#scope) : path.toString()
	}

	async run(){

		if (this.server.running) return;

		// bind @frontend to scope
		this.server.path(new RegExp(String.raw `^\/@${this.#scope.name}\/.*`), (req, path)=>{
			return path.replace(this.frontend_path, '/');
		});

		// handled default web paths
		this.server.path("/index.html", (req, path)=>this.handleIndexHTML(req, path));
		this.server.path("/favicon.ico", (req, path)=>this.handleFavicon(req, path));

		this.server.path("/new.html", (req, path)=>this.handleNewHTML(req, path));
		if (this.#app_options.installable) this.server.path("/manifest.json", (req, path)=>this.handleManifest(req, path));
		this.server.path("/_uix_sw.js", (req, path)=>this.handleServiceWorker(req, path));
		this.server.path("/_uix_sw.ts", (req, path)=>this.handleServiceWorker(req, path));

		// handle routes (ignore @_internal, @backend, .dx, ...)
		this.server.path(/^\/[^@.].*/, (req, path)=>{
			console.log(path);
		});

		// if (this.generator){
		// 	this.server.path("/entrypoint.js", (req, path)=>this.handleSSREntrypoint(req, path));
		// 	this.server.path("/entrypoint.ts", (req, path)=>this.handleSSREntrypoint(req, path));
		// }

		await this.server.listen();

		if (this.#live) await this.createLiveScript()
	}

	#backend_virtual_files = new Map<string, Map<string, Set<string>>>()

	// resolve oos paths from local (client side) imports - resolve to web (https) paths
	// if no_side_effects is true, don't update any files
	private async handleOutOfScopePath(import_path:Path, module_path:Path, imports:Set<string>, no_side_effects:boolean){
		
		// console.log("oos", module_path.toString(), import_pseudo_path.toString(), rel_import_pseudo_path)

		// try {
			if ((await Deno.stat(import_path)).isFile) {
				const type = getDirType(this.#app_options, import_path);
				
				if (type == "backend") {
					const web_path = '/@' + import_path.getAsRelativeFrom(this.#base_path).slice(2) // remove ./
					const import_pseudo_path = this.#scope.getChildPath(web_path);
					// const rel_import_pseudo_path = import_pseudo_path.getAsRelativeFrom(module_path.parent_dir);

					if (!no_side_effects) await this.updateBackendInterfaceFile(web_path, import_pseudo_path, import_path, module_path, imports);

					return web_path // rel_import_pseudo_path;
				}
		
				else if (type == "common") {
					for (const [path, [transpiler, web_root_path]] of this.#common_transpilers) {
						if (import_path.isChildOf(path)) {
							const web_path = web_root_path + transpiler.getDistPath(import_path, false, false)?.getAsRelativeFrom(transpiler.dist_dir).slice(2);
							return web_path
						}
					}
				}
		
				else if (type == "frontend") {
					// resolve from common
					return "[ERROR: TODO resolve frontend paths from common dir]"
				}
		
				else {
					this.#logger.error("Could not resolve invalid out of scope path: " + import_path);
					return "[ERROR: server could not resolve path (outside of scope)]"
				}
			}

			return "[ERROR: import path not a file path]"
			
			
		// } catch (e) {
		// 	return "[server error: "+e.message+"]"
		// }

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

		const combined_imports_before = <Set<string>> new Set([...used_imports.values()].reduce((a, c) => a.concat( [...c] ), []))
		// update imports used by module
		this.#backend_virtual_files.get(web_path)!.set(module_path_string, imports)
		const new_combined_imports = <Set<string>> new Set([...used_imports.values()].reduce((a, c) => a.concat( [...c] ), []))
		// check if imports changed:
	
		let changed = false;
		const removed = new Set();

		for (const import_before of combined_imports_before) {
			if (!new_combined_imports.has(import_before)) {changed = true; removed.add(import_before);} // removed import
		}
		for (const new_import of new_combined_imports) {
			if (!combined_imports_before.has(new_import)) changed = true; // added import
		}

		// imports changed, update file
		if (changed) {
			this.#logger.info(`exposed exports of ${this.getShortPathName(import_path)} have changed: ${new_combined_imports.size ? `\n#color(green)  + ${[...new_combined_imports].join(", ")}` :' '}${removed.size ? `\n#color(red)  - ${[...removed].join(", ")}` : ''}`)
			
			const ts_code = await this.generateOutOfScopeFileContent(import_path, web_path, module_path, new_combined_imports);
			await this.transpiler.addVirtualFile(import_pseudo_path, ts_code, true);
		}

		resolve_done?.();
	}

	private getShortPathName(path:Path) {
		return path.getAsRelativeFrom(this.#scope.parent_dir).replace(/^\.\//, '')
	}
	

	/**
	 * generate TS source code with exported interfaces
	 * @param path module path
	 * @param exports exports to generate code for
	 * @returns 
	 */
	private async generateOutOfScopeFileContent(path:Path, web_path:string, module_path:Path, exports:Set<string>) {
		const module = await import(path.toString());

		const values:[string, unknown, boolean][] = [];
		for (const exp of exports) {
			if (!(exp in module)) this.#logger.error(this.getShortPathName(module_path) + ": '" + exp + "' is currently not a exported value in module " + this.getShortPathName(path) + " - backend restart might be required")
			values.push([exp, module[exp], exp in module]);
		}
		return generateMatchingJSValueCode(web_path, values);
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
		await this.transpiler.addVirtualFile("@_internal/live.ts", script);

		this.#client_scripts.push("/@_internal/live.ts")

	}

	#ignore_reload = false;

	private async handleFrontendReload(){
		if (!this.#live) return;
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

	private async handleIndexHTML(requestEvent: Deno.RequestEvent, _path:string) {
		const compat = Server.isSafariClient(requestEvent.request);
		try {
			// @ts-ignore TODO: generator
			const component = this.generator ? await this.generator() : null;
			let skeleton: string;
			if (component instanceof UIX.Components.Base) {
				await component.connectedCallback(); // make sure DOM is loaded
				skeleton = component.getSkeleton();
			}
			else skeleton = "x"

			await this.server.serveContent(requestEvent, "text/html", this.generateHTMLPage(skeleton, this.#client_scripts, (new Path('./entrypoint.ts', this.#scope).fs_exists) ?  this.frontend_path + 'entrypoint.ts' : undefined, compat));

		} catch (e) {
		}			
	}

	// html page for new empty pages (includes blank.ts)
	private async handleNewHTML(requestEvent: Deno.RequestEvent, _path:string) {
		const compat = Server.isSafariClient(requestEvent.request);
		await this.server.serveContent(requestEvent, "text/html", this.generateHTMLPage("", [...this.#client_scripts, this.#BLANK_PAGE_URL], undefined, compat));
	}

	private async handleServiceWorker(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			await this.server.serveContent(requestEvent, "text/javascript", await (await fetch(this.resolveImport('uix/sw/sw.ts', true /** must be resolved to URL */))).text());
		} catch (e) {
		}			
	}

	private async handleFavicon(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			await this.server.serveContent(requestEvent, "image/*", await (await fetch(this.resolveImport(this.#app_options.icon_path, true /** must be resolved to URL */))).text());
		} catch (e) {
			console.log(e)
		}			
	}

	private async handleManifest(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			await this.server.serveContent(requestEvent, "application/json", JSON.stringify({
				"name": this.#app_options.name,
				"description": this.#app_options.description,
				"default_locale": "en",
				"version": this.#app_options.version,
				"icons": [
				  {
					"src": this.resolveImport(this.#app_options.icon_path),
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
				
				// "file_handlers": [
				//   {
				// 	"action": "/",
				// 	"accept": {
				// 	  "application/datex": ".dxb",
				// 	  "text/datex": ".dx"
				// 	},
				// 	"icons": [
				// 	  {
				// 		"src": "https://workbench.unyt.org/unyt_web/assets/logo_icon.png",
				// 		"sizes": "287x287",
				// 		"type": "image/png"
				// 	  }
				// 	],
				// 	"launch_type": "single-client"
				//   }
				// ]
			}));
		} catch (e) {
		}			
	}


	private getRelativeImportMap() {
		const import_map = {imports: {...this.#app_options.import_map.imports}};

		for (const [key, value] of Object.entries(import_map.imports)) {
			import_map.imports[key] = this.import_resolver.resolveRelativeImportMapImport(value, this.#scope);
		}

		return import_map;
	}


	private generateHTMLPage(skeleton_content?:string, js_files:(URL|string|undefined)[] = [], entrypoint?:URL|string, compat_import_map = false){
		let files = '';
		
		//js files
		files += '<script type="module">'

		// set app info
		files += this.indent(4) `
			${"import {Datex, f}"} from "${this.resolveImport("unyt_core", compat_import_map).toString()}";
			${"import {UIX}"} from "${this.resolveImport("uix", compat_import_map).toString()}";
			UIX.State._setMetadata({name:"${this.#app_options.name??''}", version:"${this.#app_options.version??''}", stage:"${this.#app_options.stage??''}", backend:f("${Datex.Runtime.endpoint.toString()}")});`

		for (const file of js_files) {
			if (file) files += this.indent(4) `\nawait import("${this.resolveImport(file, compat_import_map).toString()}");`
		}

		if (entrypoint) {
			files += this.indent(4) `\nconst module_exports = Object.values(await import("${this.resolveImport(entrypoint, compat_import_map).toString()}"));\nif (module_exports.length) UIX.State.set(module_exports[0])`
		}

		files += '\n</script>'

		let importmap = ''
		if (this.#app_options.import_map) importmap = `<script type="importmap">\n${JSON.stringify(this.getRelativeImportMap(), null, 4)}\n</script>`

		// global variable stylesheet
		let global_style = "<style>"
		for (const rule of UIX.Theme.stylesheet.cssRules) {
			global_style += rule.cssText;
		}
		global_style += "</style>"

		let favicon = "";
		if (this.#app_options.icon_path) favicon = `<link rel="icon" href="${this.resolveImport(this.#app_options.icon_path, compat_import_map)}">`

		let title = "";
		if (this.#app_options.name) title = `<title>${this.#app_options.name}</title>`

		return this.indent `
			<!DOCTYPE html>
			<html>
				<head>
					${title}
					${favicon}
					${this.#app_options.installable ? `<link rel="manifest" href="manifest.json">` : ''}
					${global_style}
					${importmap}
					${files}
				</head>
				<body></body>
			</html>
		`
		/*
		<main class="root-container">
			${skeleton_content??''}
		</main>
		*/
	}

	private indent(string:TemplateStringsArray, ...insert:(string|undefined)[]): string
	private indent(base_indentation:number): (string:TemplateStringsArray, ...insert:(string|undefined)[]) => string
	private indent(string:TemplateStringsArray|number, base_indent?:any, ...insert:(string|undefined)[]) {
		
		// create indent function with base indent
		if (typeof string == "number") return (_string:TemplateStringsArray, ...insert:(string|undefined)[])=>this.indent(_string, <any>string, ...insert)

		if (typeof base_indent == "string") {
			insert = [base_indent, ...insert]; // base_indent not used, use as insert string
			base_indent = 0;
		}


		const tab_as_space = '    ';
		const remove_indentation = string[0].replace(/\t/gm, tab_as_space).match(/\n*(\s*)/)?.[1].length ?? 0;

		let combined = "";

		for (let i=0; i<string.length; i++) {
			const nstring = string[i].replace(/\t/gm, tab_as_space);
			const line_indentation = nstring.match(/\n*(\s*)/)?.[1].length ?? 0;
			combined += nstring.replace(new RegExp('\\n\\s{'+remove_indentation+'}', 'gm'), '\n').replace(/\n/gm, '\n' + ' '.repeat(base_indent));
			if (i < insert.length) combined += insert[i]?.replace(/\n/gm, '\n' + ' '.repeat(base_indent+Math.max(0,line_indentation-remove_indentation))) ?? '';
		}

		return combined;
	}

}



const reload_handlers = new Set<()=>void>();

@endpoint class provider {
	@property static addReloadHandler(handler:()=>void) {
		reload_handlers.add(handler)
	}
}