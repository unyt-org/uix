import { TypescriptTranspiler } from "unyt_node/ts_transpiler.ts";
import { TypescriptImportResolver } from "unyt_node/ts_import_resolver.ts";

import { Datex } from "unyt_core";
import { Server } from "unyt_node/server.ts";
import { UIX } from "../uix.ts";
import { getDirType, normalized_app_options, validateDirExists } from "./app.ts";
import { generateMatchingJSValueCode } from "./interface_generator.ts";
import { Path } from "unyt_node/path.ts";

const relative = globalThis.Deno ? (await import("https://deno.land/std@0.172.0/path/mod.ts")).relative : null;

export class FrontendManager {

	constructor(app_options:normalized_app_options, path:Path, base_path:Path, watch = false, live = false) {

		validateDirExists(path, 'frontend');

		this.#path = new Path(path);
		this.#base_path = new Path(base_path);

		this.#app_options = app_options;
		this.#live = live;
		this.#watch = watch;
		this.#logger = new Datex.Logger("UIX Frontend");
		this.#logger.success("init at " + this.#path);

		this.#app_options.backend.forEach((v)=>this.#backend_urls.add(v))
		this.#app_options.common.forEach((v)=>this.#common_urls.add(v))

		if (this.#app_options.import_map) this.#import_map = this.#app_options.import_map
		if (this.#app_options.offline_support) this.#client_scripts.push('uix/app/client_sw.ts');

		this.initServerAndTranspiler();
	}

	initServerAndTranspiler(){

		this.import_resolver = new TypescriptImportResolver();

		this.transpiler = new TypescriptTranspiler(this.#path, {
			watch: this.#watch,
			on_file_update: this.#watch ? ()=>this.handleFrontendReload() : undefined,
			import_resolver: this.import_resolver
		});

		this.server = new Server(this.#path, undefined, {
			resolve_index_html: true,
			cors: true,
			transpiler: this.transpiler
		});

		if (!this.#import_map) this.#import_map = {imports: this.transpiler.import_map}; // use import map from transpiler per default
	}

	#BLANK_PAGE_URL = 'uix/base/blank.ts';

	server!: Server
	transpiler!: TypescriptTranspiler
	import_resolver!: TypescriptImportResolver

	#live = false;
	#watch = false;

	#logger: Datex.Logger

	#backend_urls = new Set<URL>();
	#common_urls = new Set<URL>();

	#base_path!:Path
	#path!:Path

	#app_options!:normalized_app_options

	#import_map?:{imports: Record<string,string>}

	#client_scripts:(URL|string)[] = [
		'uix/app/client_default.ts'
	]

	private resolveImport(path:string|URL, compat_import_map = false){
		return this.server.resolveImport(path, undefined, compat_import_map)
	}

	async run(){

		if (this.server.running) return;

		// web server
		// handle oos paths
		// handled default web paths
		this.server.path("/index.html", (req, path)=>this.handleIndexHTML(req, path));
		this.server.path("/favicon.ico", (req, path)=>this.handleFavicon(req, path));

		this.server.path("/new.html", (req, path)=>this.handleNewHTML(req, path));
		if (this.#app_options.installable) this.server.path("/manifest.json", (req, path)=>this.handleManifest(req, path));
		this.server.path("/_uix_sw.js", (req, path)=>this.handleServiceWorker(req, path));
		this.server.path("/_uix_sw.ts", (req, path)=>this.handleServiceWorker(req, path));

		// if (this.generator){
		// 	this.server.path("/entrypoint.js", (req, path)=>this.handleSSREntrypoint(req, path));
		// 	this.server.path("/entrypoint.ts", (req, path)=>this.handleSSREntrypoint(req, path));
		// }

		await this.server.listen();

		if (this.#live) await this.createLiveScript()
	}


	private oosPaths = new Map<string,Map<string,string>>();

	// resolve oos paths from local (client side) imports - resolve to web (https) paths
	private async handleOutOfScopePath(module_path:string, import_path:string, imports?:string[]){

		if (this.oosPaths.get(module_path)?.has(import_path)) return this.oosPaths.get(module_path)!.get(import_path)!;
		if (!this.oosPaths.has(module_path)) this.oosPaths.set(module_path, new Map())

		const module_dir = new URL("./", "file://"+module_path).toString().replace("file://","");

		const import_pseudo_path = '/@' + relative!(this.#base_path.pathname, import_path);
		const interf_mod_path = this.#path.pathname + import_pseudo_path;
		let relative_interf_mod_path = relative!(module_dir, interf_mod_path);
		if (!relative_interf_mod_path.startsWith(".")) relative_interf_mod_path = "./" + relative_interf_mod_path; // make relative path

		const web_path = "/" + relative!(this.#path.pathname, interf_mod_path);

		// console.log("oos", module_path, import_path, import_pseudo_path, interf_mod_path)

		try {
			if ((await Deno.stat(import_path)).isFile) {
				let ts_code = "";
				const type = getDirType(this.#app_options, import_path);
		
				if (type == "backend") {
					ts_code = await this.generateOutOfScopeFileContent(import_path, web_path, imports);
					this.#logger.info("backend interface file: " + "http://localhost:" + this.server.port + web_path);
				}
		
				else if (type == "common") {
					ts_code = await Deno.readTextFile(import_path);
					this.#logger.info("common file: " + "http://localhost:" + this.server.port + web_path);
				}
		
				else if (type == "frontend") {
					this.#logger.warn("TODO handle shared frontend modules")
				}
		
				else {
					this.#logger.error("Could not resolve invalid out of scope path: " + import_path);
					return "[server could not resolve path]"
				}
		
				await this.transpiler.addVirtualFile(interf_mod_path, ts_code);
				this.setOutOfScopePathListener(import_path, web_path, interf_mod_path);
			}

			// TODO: if directory, decide which children files to resolve / copy / compile
			
		} catch (e) {
			// console.log(e)
		}
		

		// cache
		this.oosPaths.get(module_path)!.set(import_path, relative_interf_mod_path);

		return relative_interf_mod_path;
	}

	#active_listeners = new Set<string>();

	private async setOutOfScopePathListener(path:string, web_path:string, virtual_path:string){
		if (!this.server) throw new Error("no server");
		if (this.#active_listeners.has(path)) return;
		this.#active_listeners.add(path);

		// console.log("listening to oos file " + path + " (virtual path " + virtual_path + ")");

		for await (const event of Deno.watchFs(path)) {
			const js_code = await this.generateOutOfScopeFileContent(path, web_path);
			await this.transpiler.addVirtualFile(virtual_path, js_code)
		}
	}

	/**
	 * generate TS source code with exported interfaces
	 * @param path module path
	 * @param exports exports to generate code for
	 * @returns 
	 */
	private async generateOutOfScopeFileContent(path:string, web_path:string, exports?:string[]) {
		const module = await import("file://"+path);

		const values:[string, unknown][] = [];
		for (const exp of /*exports??*/Object.keys(module)) {
			if (!module[exp]) throw new Error("requested import '" + exp + "' is not exported in module '" + path + "'")
			values.push([exp, module[exp]]);
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
			const component = this.generator ? await this.generator() : null;
			let skeleton: string;
			if (component instanceof UIX.Components.Base) {
				await component.connectedCallback(); // make sure DOM is loaded
				skeleton = component.getSkeleton();
			}
			else skeleton = "x"

			await this.server.serveContent(requestEvent, "text/html", await this.generateHTMLPage(skeleton, this.#client_scripts, './entrypoint.ts', compat), [{name:"importmap", value:encodeURIComponent(JSON.stringify(this.#import_map))}]);

		} catch (e) {
			console.log(e)
		}			
	}

	// html page for new empty pages (includes blank.ts)
	private async handleNewHTML(requestEvent: Deno.RequestEvent, _path:string) {
		const compat = Server.isSafariClient(requestEvent.request);
		await this.server.serveContent(requestEvent, "text/html", await this.generateHTMLPage("", [...this.#client_scripts, this.#BLANK_PAGE_URL], undefined, compat), [{name:"importmap", value:encodeURIComponent(JSON.stringify(this.#import_map))}]);
	}

	private async handleServiceWorker(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			await this.server.serveContent(requestEvent, "text/javascript", await (await fetch(this.resolveImport('uix/sw/sw.ts', true /** must be resolved to URL */))).text());
		} catch (e) {
			console.log(e)
		}			
	}

	private async handleFavicon(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			await this.server.serveContent(requestEvent, "image/*", await (await fetch(this.resolveImport(this.#app_options.icon_path, true /** must be resolved to URL */))).text());
		} catch (e) {
			console.log(e)
		}			
	}

	private async handleSSREntrypoint(requestEvent: Deno.RequestEvent, _path:string) {
		// TODO generate components (also for index skeleton)
		const content = "TODO"
		try {
			await this.server.serveContent(requestEvent, "text/javascript", content);
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
					"src": this.toWebResolvablePath(this.#app_options.icon_path),
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
			console.log(e)
		}			
	}

	private async getWebImportMap(){
		const web_import_map = {imports:{...this.#import_map?.imports}};
		if (!web_import_map.imports) throw "invalid import map";

		for (const [key, val] of Object.entries(web_import_map.imports)) {
			// shift relative directory if resolved from import map, because import map is located outside frontend/ directory (TODO: more general approach?)
			if (val.startsWith("./")) {
				const import_path = new URL("."+val, this.#path);

				// is out of scope
				if (!import_path.toString().startsWith(this.#path.toString())) {
					web_import_map.imports[key] = await this.handleOutOfScopePath(this.#path.toString().replace("file://", "") + "__x__.ts", import_path.toString().replace("file://", "")) + (import_path.toString().endsWith("/") ? "/" : "")
				}

				// just relative
				else web_import_map.imports[key] = "./" + import_path.toString().replace(this.#path.toString(), '');
			}
		}
		// console.log(web_import_map)

		return JSON.stringify(web_import_map)
	}

	
	private toWebResolvablePath(url:URL|string, compat_import_map = false) {
		return this.resolveImport(url, compat_import_map); // non-path module specifier
	}

	private async generateHTMLPage(skeleton_content?:string, js_files:(URL|string|undefined)[] = [], entrypoint?:URL|string, compat_import_map = false){
		let files = '';
		
		//js files
		files += '<script type="module">'

		// set app info
		files += `
${"import {Datex, f}"} from "${this.toWebResolvablePath("unyt_core", compat_import_map)}";
${"import {UIX}"} from "${this.toWebResolvablePath("uix", compat_import_map)}";
UIX.State._setMetadata({name:"${this.#app_options.name??''}", version:"${this.#app_options.version??''}", stage:"${this.#app_options.stage??''}", backend:f("${Datex.Runtime.endpoint.toString()}")});`

		for (const file of js_files) {
			if (file) files += `\nawait import("${this.toWebResolvablePath(file, compat_import_map)}");`
		}

		if (entrypoint) {
			files += `\nconst module_exports = Object.values(await import("${this.toWebResolvablePath(entrypoint, compat_import_map)}"));\nif (module_exports.length) UIX.State.set(module_exports[0])`
		}

		files += '\n</script>'

		let importmap = ''
		if (this.#import_map) importmap = `<script type="importmap">${await this.getWebImportMap()}</script>`

		// global variable stylesheet
		let global_style = "<style>"
		for (const rule of UIX.Theme.stylesheet.cssRules) {
			global_style += rule.cssText;
		}
		global_style += "</style>"

		let favicon = "";
		if (this.#app_options.icon_path) favicon = `<link rel="icon" href="${this.toWebResolvablePath(this.#app_options.icon_path, compat_import_map)}">`

		let title = "";
		if (this.#app_options.name) title = `<title>${this.#app_options.name}</title>`

		return `
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
				<body>
				
				</body>
			</html>
		`
		/*
		<main class="root-container">
			${skeleton_content??''}
		</main>
		*/
	}

}



const reload_handlers = new Set<()=>void>();

@endpoint class provider {
	@property static addReloadHandler(handler:()=>void) {
		reload_handlers.add(handler)
	}
}