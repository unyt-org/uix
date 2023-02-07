import { Datex } from "unyt_core";
import { Server } from "unyt_node/server.ts";
import { UIX } from "../uix.ts";
import { getDirType, normalized_app_options, validateDirExists } from "./app.ts";
import { generateMatchingJSValueCode } from "./interface_generator.ts";


const walk = globalThis.Deno ? (await import("https://deno.land/std/fs/mod.ts")).walk : null;
const relative = globalThis.Deno ? (await import("https://deno.land/std@0.172.0/path/mod.ts")).relative : null;

export class FrontendManager {

	constructor(app_options:normalized_app_options, path:URL, base_path:URL, live = false) {

		validateDirExists(path, 'frontend');

		this.#path = path;
		this.#base_path = base_path;

		this.#app_options = app_options;
		this.#live = live;
		this.#logger = new Datex.Logger("UIX Frontend");
		this.#logger.success("init at " + this.#path);

		this.#app_options.backend.forEach((v)=>this.#backend_urls.add(v))
		this.#app_options.common.forEach((v)=>this.#common_urls.add(v))

		if (this.#app_options.import_map) this.#import_map = this.#app_options.import_map

		if (this.#app_options.offline_support) this.#client_scripts.push('uix/app/client_sw.ts');
	}


	#BLANK_PAGE_URL = 'uix/base/blank.ts';

	#server!: Server
	#live = false
	#logger: Datex.Logger

	#backend_urls = new Set<URL>();
	#common_urls = new Set<URL>();

	#base_path!:URL
	#path!:URL

	#app_options!:normalized_app_options

	#import_map?:{imports: Record<string,string>}

	#client_scripts:(URL|string)[] = [
		'uix/app/client_default.ts'
	]

	get server(){
		if (!this.#server) this.#server = new Server(this.#path, undefined, {resolveIndexHTML:false, watch:this.#live});
		if (!this.#import_map) this.#import_map = {imports: this.#server.import_map}; // use import map from server per default
		return this.#server;
	}

	private resolveImport(path:string|URL, compat_import_map = false){
		return this.server.resolveImport(path, undefined, compat_import_map)
	}

	async run(){

		if (this.server.running) return;

		// web server

		// update server config
		this.server.config(this.#path, undefined, {resolveIndexHTML:false, watch:this.#live})
		// set import map
		if (this.#import_map) this.server.setImportMap(this.#import_map);
		// handle oos paths
		this.server.setOutOfScopeJSPathHandler((path, import_path, imports)=>this.handleOutOfScopePath(path, import_path, imports));
		// handled default web paths
		this.server.path("/", (req, path)=>this.handleIndexHTML(req, path));
		this.server.path("/new.html", (req, path)=>this.handleNewHTML(req, path));
		if (this.#app_options.installable) this.server.path("/manifest.json", (req, path)=>this.handleManifest(req, path));
		this.server.path("/_uix_sw.js", (req, path)=>this.handleServiceWorker(req, path));
		this.server.path("/_uix_sw.ts", (req, path)=>this.handleServiceWorker(req, path));

		// if (this.generator){
		// 	this.server.path("/entrypoint.js", (req, path)=>this.handleSSREntrypoint(req, path));
		// 	this.server.path("/entrypoint.ts", (req, path)=>this.handleSSREntrypoint(req, path));
		// }

		await this.server.listen();

		// await this.generateInterfaceFiles();
		if (this.#live) await this.createLiveScript()
	}

	// private async generateInterfaceFiles(){
	// 	for (const backend of this.#backend_urls) {
	// 		// find .public.ts files to expose interfaces
	// 		for await (const e of walk!(backend, {includeDirs: false, exts: ['.public.ts']})) {
	// 			this.handleOutOfScopePath("", e.path);
	// 		}
	// 	}
		
	// }

	// resolve oos paths from local (client side) imports - resolve to web (https) paths
	private async handleOutOfScopePath(module_path:string, import_path:string, imports?:string[]){

		const module_dir = new URL("./", "file://"+module_path).toString().replace("file://","");

		const import_pseudo_path = '/@' + relative!(this.#base_path.pathname, import_path);
		const interf_mod_path = this.#path.pathname + import_pseudo_path;
		let relative_interf_mod_path = relative!(module_dir, interf_mod_path);
		if (!relative_interf_mod_path.startsWith(".")) relative_interf_mod_path = "./" + relative_interf_mod_path; // make relative path

		const web_path = "/" + relative!(this.#path.pathname, interf_mod_path);


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

		await this.#server.createVirtualFile(interf_mod_path, ts_code);
		this.setOutOfScopePathListener(import_path, web_path, interf_mod_path);

		return relative_interf_mod_path;
	}

	#active_listeners = new Set<string>();

	private async setOutOfScopePathListener(path:string, web_path:string, virtual_path:string){
		if (!this.#server) throw new Error("no server");
		if (this.#active_listeners.has(path)) return;
		this.#active_listeners.add(path);

		// console.log("listening to oos file " + path + " (virtual path " + virtual_path + ")");

		for await (const event of Deno.watchFs(path)) {
			const js_code = await this.generateOutOfScopeFileContent(path, web_path);
			await this.#server.createVirtualFile(virtual_path, js_code)
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
		if (!this.#server) return;

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

		const path = this.#path.pathname + "/@_internal/live.ts";
		await this.#server.createVirtualFile(path, script);

		this.#client_scripts.push("/@_internal/live.ts")

		let ignore = false;
		// listen to frontend file changes
		this.#server.onFrontendUpdate = async ()=>{
			if (ignore) return;
			ignore = true;
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

			setTimeout(()=>ignore=false, 500); // wait some time until next update triggered

			setTimeout(()=>{
				if (reload_handlers.size) this.#logger.info("reloaded " + reload_handlers.size + " endpoint client" + (reload_handlers.size==1?'':'s'));
			}, 200); // wait some time until next update triggered

		}

	}

	private async handleIndexHTML(requestEvent: Deno.RequestEvent, _path:string) {
		const compat = Server.isSafari(requestEvent.request);
		try {
			const component = this.generator ? await this.generator() : null;
			let skeleton: string;
			if (component instanceof UIX.Components.Base) {
				await component.connectedCallback(); // make sure DOM is loaded
				skeleton = component.getSkeleton();
			}
			else skeleton = "x"

			await Server.serveContent(requestEvent, "text/html", this.generateHTMLPage(skeleton, this.#client_scripts, './entrypoint.ts', compat), [{name:"importmap", value:encodeURIComponent(JSON.stringify(this.#import_map))}]);

		} catch (e) {
			console.log(e)
		}			
	}

	// html page for new empty pages (includes blank.ts)
	private async handleNewHTML(requestEvent: Deno.RequestEvent, _path:string) {
		const compat = Server.isSafari(requestEvent.request);
		await Server.serveContent(requestEvent, "text/html", this.generateHTMLPage("", [...this.#client_scripts, this.#BLANK_PAGE_URL], undefined, compat), [{name:"importmap", value:encodeURIComponent(JSON.stringify(this.#import_map))}]);
	}

	private async handleServiceWorker(requestEvent: Deno.RequestEvent, _path:string) {
		const compat = Server.isSafari(requestEvent.request);
		try {
			await Server.serveContent(requestEvent, "text/javascript", await (await fetch(this.resolveImport('uix/sw/sw.ts', true /** must be resolved to URL */))).text());
		} catch (e) {
			console.log(e)
		}			
	}

	private async handleSSREntrypoint(requestEvent: Deno.RequestEvent, _path:string) {
		// TODO generate components (also for index skeleton)
		const content = "TODO"
		try {
			await Server.serveContent(requestEvent, "text/javascript", content);
		} catch (e) {
			console.log(e)
		}			
	}

	private async handleManifest(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			await Server.serveContent(requestEvent, "application/json", JSON.stringify({
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

	
	private toWebResolvablePath(url:URL|string, compat_import_map = false) {
		const path = this.resolveImport(url, compat_import_map); // non-path module specifier
		console.log("wpath",path);

		// if (typeof url == "string") {
		// 	if (path.startsWith("https://") || path.startsWith("http://")) return path; // http(s)
		// 	else return 
		// }
		// // http(s) url
		// if (url.protocol == "https:" || url.protocol == "http:") return url.toString()
		// // file url
		// else return "./" + url.toString().replace(this.#path.toString(), '')
		return path;
	}

	private generateHTMLPage(skeleton_content?:string, js_files:(URL|string|undefined)[] = [], entrypoint?:URL|string, compat_import_map = false){
		let files = '';
		
		//js files
		files += '<script type="module">'

		// set app info
		files += `import {Datex, f} from "${this.toWebResolvablePath("unyt_core", compat_import_map)}";\nDatex.Unyt.setApp("${this.#app_options.name??''}", "${this.#app_options.version??''}", "${this.#app_options.stage??''}", f("${Datex.Runtime.endpoint.toString()}"));`

		for (const file of js_files) {
			if (file) files += `\nawait import("${this.toWebResolvablePath(file, compat_import_map)}");`
		}

		if (entrypoint) {
			files += `\nconst module_exports = Object.values(await import("${this.toWebResolvablePath(entrypoint, compat_import_map)}"));\nif (module_exports.length) UIX.State.set(module_exports[0])`
		}

		files += '\n</script>'

		let importmap = ''
		if (this.#import_map) importmap = `<script type="importmap">${JSON.stringify(this.#import_map)}</script>`

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