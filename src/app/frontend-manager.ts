import { Transpiler } from "../server/transpiler.ts";
import { TypescriptImportResolver } from "../server/ts-import-resolver.ts";

import { $$, Datex } from "datex-core-legacy";
import { Server, requestMetadata } from "../server/server.ts";
import { ALLOWED_ENTRYPOINT_FILE_NAMES, app } from "./app.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { BackendManager } from "./backend-manager.ts";
import { getExistingFile, getExistingFileExclusive } from "../utils/file-utils.ts";
import { logger } from "../utils/global-values.ts";
import { generateHTMLPage, getOuterHTML } from "../html/render.ts";
import { HTMLProvider } from "../html/html-provider.ts";

import { provideValue } from "../html/entrypoint-providers.tsx";
import type { normalizedAppOptions } from "./options.ts";
import { getDirType } from "./utils.ts";
import { generateTSModuleForRemoteAccess, generateDTSModuleForRemoteAccess } from "datex-core-legacy/utils/interface-generator.ts"
import { resolveEntrypointRoute } from "../routing/rendering.ts";
import { OPEN_GRAPH, OpenGraphInformation } from "../base/open-graph.ts";
import { RenderMethod } from "../base/render-methods.ts";
import { Context, ContextBuilder, ContextGenerator, getHTTPRequestEndpoint } from "../routing/context.ts";
import { Entrypoint, raw_content } from "../html/entrypoints.ts";
import { createErrorHTML } from "../html/errors.tsx";
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { domUtils } from "./dom-context.ts";
import { getLiveNodes } from "../hydration/partial.ts";
import { UIX } from "../../uix.ts";
import { UIX_COOKIE, getCookie, setCookie } from "../session/cookies.ts";
import { observeElementforSSE } from "./sse-observer.ts";
import { eternalExts, getEternalModuleProxyPath } from "./module-mapping.ts";
import { rootPath } from "./args.ts";
import { isSafariClient } from "../utils/safari.ts";

const {serveDir} = client_type === "deno" ? (await import("https://deno.land/std@0.164.0/http/file_server.ts")) : {serveDir:null};


export class FrontendManager extends HTMLProvider {

	srcPrefix = "/@uix/src/"
	externalPrefix = "/@uix/external/"
	debugPrefix = "/@uix/debug/"

	srcPrefixRegex = String.raw `\/@uix\/src\/`

	constructor(app_options:normalizedAppOptions, scope:URL, base_path:URL, backend?:BackendManager, watch = false, live = false) {

		const scopePath = Path.File(scope);
		const basePath = Path.File(base_path);

		if (!scopePath.fs_exists) {
			logger.error("The specified frontend directory '"+scopePath+"' does not exist.");
			throw new Error("UIX App initialization failed");
		}

		const import_resolver = new TypescriptImportResolver(scopePath, {
			import_map: app_options.import_map,
			import_map_base_path: basePath,
			interface_extensions: ['.dx', '.dxb'],
			interface_prefixes: ['@'],
			handle_out_of_scope_path: (path: Path.File|string, from:Path, imports:Set<string>, no_side_effects:boolean) => this.handleOutOfScopePath(path, from, imports, no_side_effects)
		});

		super(scopePath, app_options, import_resolver, live, basePath)

		this.#base_path = basePath;
		this.#web_path = new Path(`uix://${this.srcPrefix}${this.scope.name}/`);
		this.#backend = backend;
		this.#watch = watch;
		this.#logger = new Datex.Logger("UIX Frontend");

		// TODO: fix offline caching, currently sends multiple requests to the server in forms
		// if (this.app_options.offline_support) this.#client_scripts.push('uix/app/client-scripts/sw.ts');

		this.initFrontendDir();
		this.intCommonDirs();
		this.initServer();
		this.updateCheckEntrypoint();

		// generate entrypoint.ts interface for backend
		if (this.#backend?.web_entrypoint && this.#backend.entrypoint) this.handleOutOfScopePath(this.#backend.entrypoint, this.scope, new Set(["default"]), false, true);
		// bind virtual backend entrypoint
		if (this.#backend?.web_entrypoint && this.#backend?.virtualEntrypointContent) {
			const path = this.resolveImport(this.#backend?.web_entrypoint);
			//console.log("PATH:" + this.resolveImport(this.#backend?.web_entrypoint))
			this.server.path(path, this.#backend.virtualEntrypointContent, 'text/javascript')
		}
	}

	initFrontendDir(){
		this.transpiler = new Transpiler(this.scope, {
			sourceMaps: this.app_options.source_maps ?? app.stage == "dev",
			watch: this.#watch,
			minifyJS: this.app_options.minify_js,
			import_resolver: this.import_resolver,
			on_file_update: this.#watch ? ()=>this.handleFrontendReload() : undefined,
			basePath: this.#base_path
		});
	}

	// file updates arrive on frontend also if backend is not restarted (TODO: might still lead to inconsistencies if files are added/removed)
	isTransparentFile(path: Path.File) {
		return path.hasFileExtension("css", "scss")
	}


	intCommonDirs() {
		for (const common_dir of this.app_options.common) {
			const transpiler = new Transpiler(new Path(common_dir), {
				sourceMaps: this.app_options.source_maps ?? app.stage == "dev",
				dist_parent_dir: this.transpiler.tmp_dir,
				watch: this.#watch,
				minifyJS: this.app_options.minify_js,
				import_resolver:  new TypescriptImportResolver(new Path(common_dir), {
					import_map: this.app_options.import_map,
					import_map_base_path: this.#base_path,
					handle_out_of_scope_path: (path: Path.File|string, from:Path, imports:Set<string>, no_side_effects:boolean) => this.handleOutOfScopePath(path, from, imports, no_side_effects)
				}),
				on_file_update: this.#watch ? (path)=>{
					if (!this.isTransparentFile(path)) {
						this.#backend?.handleUpdate("common");
					}
					this.handleFrontendReload();
				} : undefined,
				basePath: this.#base_path
			})
			this.#common_transpilers.set(common_dir.toString(), [transpiler, this.srcPrefix + new Path(common_dir).name + '/'])

		}
	}

	initServer() {
		const transpilers:Record<string,Transpiler> = {}

		// set common transpilers to @... web paths
		for (const [_path, [transpiler, web_path]] of this.#common_transpilers) {
			transpilers[web_path] = transpiler
		}

		// set default compiler to root web path
		transpilers['/'] = this.transpiler

		this.server = new Server(this.scope, {
			resolve_index_html: false,
			directory_indices: true,
			cors: true,
			transpilers
		});
		// inject dependencies to server, should be handled in another way, but server should stay standalone
		this.server._base_path = this.base_path
		this.server._app = app;
		this.server._uix_init = true;
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
				// TODO: custom pages name
				this.transpiler.addVirtualFile('entrypoint.ts', `import { UIX } from "uix"; export default new UIX.PageProvider("../pages/", "frontend");`, true)
			}

		}
		catch {
			logger.error("Only one of the following entrypoint files can exists in a directory: " + ALLOWED_ENTRYPOINT_FILE_NAMES.join(", "));
		}
	}


	getEntrypointCSS(scope: Path.File){
		const entrypoint_css_path = getExistingFile(scope, "entrypoint.css", "entrypoint.scss");
		return entrypoint_css_path ? this.#web_path.getChildPath(new Path(entrypoint_css_path).getWithFileExtension("css").name) : undefined;
	}

	#BLANK_PAGE_URL = 'uix/base/blank.ts';
	#LOGS_PAGE_URL = 'uix/app/debugging/logs.tsx';
	#NETWORK_PAGE_URL = 'uix/app/debugging/network.tsx';
	#DEBUG_LANDING_PAGE_URL = 'uix/app/debugging/main.tsx';

	server!: Server
	transpiler!: Transpiler

	#common_transpilers = new Map<string, [transpiler:Transpiler, web_path:string]>();

	#watch = false;

	#logger: Datex.Logger


	#backend?: BackendManager
	#base_path!:Path.File
	#web_path!: Path
	#entrypoint?: Path


	#client_scripts:(URL|string)[] = [
		'uix/app/client-scripts/default.ts'
	]

	#static_client_scripts:(URL|string)[] = []


	#reloads = 0;
	#showingReloads = false;
	registerReload() {
		this.#reloads++;
		if (this.#showingReloads) return;
		this.#showingReloads = true;
		// display after some delay to collect multiple reload events
		setTimeout(()=>{
			if (this.#reloads > 0) this.#logger.info("hot reloaded " + this.#reloads + " client" + (this.#reloads==1?'':'s'));
			this.#showingReloads = false;
			this.#reloads = 0;
		}, 200)
	}

	#sse_senders = new Set<(cmd: string) => void>()
	#sse_observers = new Map<(cmd: string) => void, Map<Datex.Pointer, Function>>()

	sendGlobalSSECommand(cmd: string, data?: string) {
		for (const sender of this.#sse_senders) this.sendSSECommand(sender, cmd, data);
		return this.#sse_senders.size;
	}

	sendSSECommand(sender: (cmd: string) => void, cmd: string, data?: string) {
		// show info how many RELOAD commands where send
		if (cmd === "RELOAD") this.registerReload();
		sender(cmd + (data ? ' ' + data : ''));
	}

	removeSSESender(sender: (cmd: string) => void) {
		for (const [ptr, handler] of this.#sse_observers.get(sender) ?? []) {
			ptr.unobserve(handler as any);
		}
		this.#sse_senders.delete(sender)
	}

	addSSEObserver(pointerId: string, sender: (cmd: string) => void) {
		// TODO: handle element updates
		const ptr = Datex.Pointer.get(pointerId);
		if (!ptr) return;

		if (!ptr.value_initialized || !(ptr.val instanceof Element)) {
			logger.error("cannot observe sse value");
			return;
		}

		const {cancel, eventTarget} = observeElementforSSE(ptr.val as Element)

		eventTarget.addEventListener("update", e => {
			console.log("update", e.detail)
			sender(e.detail);
		})

		if (!this.#sse_observers.has(sender)) this.#sse_observers.set(sender, new Map())
		this.#sse_observers.get(sender)!.set(ptr, cancel);
	}

	getTranspilerForPath(path: Path.File) {
		for (const transpiler of [...[...this.#common_transpilers.values()].map(t=>t[0]), this.transpiler]) {
			if (path.isChildOf(transpiler.src_dir) || Path.equals(path, transpiler.src_dir)) return transpiler;
		}
	}

	async run(){

		if (this.server.running) return;

		// bind /@uix/frontend to scope
		this.server.path(new RegExp(String.raw `^${this.srcPrefixRegex}${this.scope.name}\/.*`), (req, path)=>{
			return path.replace(this.#web_path.normal_pathname, '/');
		});

		// handled default web paths
		this.server.path("/", (req, path, con, metadata)=>this.handleRequest(req, path, con, metadata));
		this.server.path("/favicon.ico", (req, path)=>this.handleFavicon(req, path));
		this.server.path("/robots.txt", (req, path)=>this.handleRobotsTXT(req, path));

		this.server.path(/^\/@uix\/cache\/.*$/, async (req, path)=>{
			await req.respondWith(await serveDir!(req.request, {fsRoot:UIX.cacheDir.normal_pathname, urlRoot:'@uix/cache/', enableCors:true, quiet:true}))
		});

		this.server.path(/^\/@uix\/form-action\/.*$/, (req, path, con, metadata)=>{
			const ptrId = path.replace("/@uix/form-action/", "").split("/")[0].slice(1);
			const ptr = Datex.Pointer.get(ptrId)

			if (!ptr) this.server.sendError(req, 400, "Invalid Form Action");
			else {
				// console.log("form-action", ptrId, req);
				this.handleRequest(req, path, con, metadata, ptr.val)
			}
		});

		this.server.path("/@uix/window", (req, path)=>this.serveUIXPage(req, this.#BLANK_PAGE_URL));
		if (this.app_options.installable || this.app_options.manifest) this.server.path("/@uix/manifest.json", (req, path)=>this.handleManifest(req, path));
		this.server.path("/@uix/sw.js", (req, path)=>this.handleServiceWorker(req, path));
		this.server.path("/@uix/sw.ts", (req, path)=>this.handleServiceWorker(req, path));

		this.server.path("/@uix/thread-worker.ts", (req, path) => this.handleThreadWorker(req, path));
		this.server.path("/@uix/thread-worker.js", (req, path) => this.handleThreadWorker(req, path));

		this.server.path("/@uix/sse", async (req) => {

			// TODO: check if endpoint has pointer permissions if pointer observe requested
			const endpoint = getHTTPRequestEndpoint(req.request);

			let controller:ReadableStreamDefaultController|undefined;
			const sender = (cmd: string) => {
				try {
					controller?.enqueue(new TextEncoder().encode(`data: ${cmd}\r\n\r\n`));
				}
				catch {
					this.removeSSESender(sender)
				}
			}

			const body = new ReadableStream({
				start: (ctrl) => {
					controller = ctrl;
				}
			});

			const searchParams = new URL(req.request.url).searchParams;
			
			let reloading = false;

			// usid handling (for hot reloading)
			const usid = searchParams.get("usid");
			if (searchParams.has("usid")) {
				if (!usid) {
					this.sendSSECommand(sender, "ERROR Cannot enable hot reloading, empty app usid")
				}
				// is not yet reloaded client with old app usid - trigger RELOAD once
				else if (usid !== app.uniqueStartId) {
					this.sendSSECommand(sender, "RELOAD")
					reloading = true;
				}
			}
			
			if (!reloading) {
				this.#sse_senders.add(sender)
			}

			// pointer observer via sse
			const observe = searchParams.get("observe");
			if (observe) {
				// console.log("sse observe from " + endpoint, observe)
				try {
					const pointers = JSON.parse(observe);
					for (const ptrId of pointers) {
						this.addSSEObserver(ptrId, sender)
					}
				}
				catch (e) {
					console.log(e)
				}
			}

			// workaround: send PING to cancel non-active connections
			const interval = setInterval(()=>{
				this.sendSSECommand(sender, "PING");
			}, 5000)

			try {
				await req.respondWith(new Response(body, {
					headers: {
						"Content-Type": "text/event-stream",
					},
				}))
			}
			finally {
				clearInterval(interval);
				this.removeSSESender(sender)
			}
			
		});

		// debug mode enabled
		if (this.app_options.debug_mode) {
			await import("./debugging/logs-backend.ts")
			await import("./debugging/network-backend.ts")
			this.server.path("/@debug/logs", (req) => this.serveUIXPage(req, this.#LOGS_PAGE_URL));
			this.server.path("/@debug/network", (req) => this.serveUIXPage(req, this.#NETWORK_PAGE_URL));
			this.server.path(/^\/@debug($|\/.*)/, (req) => this.serveUIXPage(req, this.#DEBUG_LANDING_PAGE_URL));
		}
	
		else {
			this.server.path(/^\/@debug($|\/.*)/, (req) => req.respondWith(this.server.getErrorResponse(500, "Debug mode not enabled")))
		}


		// handle datex-over-http
		this.server.path(/^\/@uix\/datex\/?$/, async (req, path)=>{
			try {
				// TODO: fix mock requests
				const dx = await req.request.text()
				// TODO: rate limiting
				const builder = new ContextBuilder();
				const endpoint = builder.getEndpoint(req.request)
				const signed = builder.getEndpointIsTrusted(req.request);
				if (!endpoint) {
					logger.error("DATEX over HTTP: No endpoint session");
					req.respondWith(this.server.getErrorResponse(400, "No endpoint session"));
					return;
				}

				const res = await Datex.Runtime.executeDatexLocally(dx, undefined, {from:endpoint, __overrideMeta: {sender:endpoint, signed, encrypted: true}});
				await req.respondWith(await provideValue(res, {type:Datex.FILE_TYPE.JSON, mockPointers: true}));
			}
			catch (e) {
				console.log(e)
				req.respondWith(this.server.getErrorResponse(500, e?.message ?? e?.toString()));
			}
		});


		// handle routes (ignore /@uix/.... .dx)
		this.server.path(/^((?!^(\/@uix\/|\/\.dx)).)*$/, (req, path, con, metadata)=>{
			this.handleRequest(req, path, con, metadata)
		});


		await this.server.listen();

		if (this.live){
			// await this.createLiveScript()
			await this.createStaticLiveScript();
			this.handleFrontendReload() // reload frontends from before backend restart
		}

		if (this.app_options.expose_deno){
			await this.createExposeDenoScript()
		}
	}

	#backend_virtual_files = new Map<string, Map<string, [imports: Set<string>, ignore_failure?: Set<string>]>>()

	// resolve oos paths from local (client side) imports - resolve to web (https) paths
	// + resolve .dx/.dxb imports
	// if no_side_effects is true, don't update any files
	private async handleOutOfScopePath(import_path:Path.File|string, module_path:Path, imports:Set<string>, no_side_effects:boolean, ignore_export_failures:Set<string>|boolean = false){

		// TODO: propagate ignore_export_failures
		if (typeof import_path == "string") return this.handleEndpointImport(import_path, module_path, imports, no_side_effects);

		// map .dx -> .dx.ts
		let mapped_import_path = import_path;
		if (import_path.hasFileExtension("dx")) mapped_import_path = import_path.getWithFileExtension('dx.ts');
		else if (import_path.hasFileExtension("dxb")) mapped_import_path = import_path.getWithFileExtension('dxb.ts');

		// try {
		if (import_path.fs_exists && !import_path.fs_is_dir) {
			const import_type = getDirType(this.app_options, import_path);
			const module_type = getDirType(this.app_options, module_path);

			/**
			 * Don't allow frontend imports in common directories, because they are not accessible from
			 * the backend. Backend imports in common repos are still allowed.
			 */
			if (module_type == "common" && import_type == "frontend") {
				throw new Error(`Cannot import modules from a ${import_type} directory in a ${module_type} module (${module_path})`);
			}

			if (import_type == "backend") {
				// map eternal.ts modules to proxy paths
				if (import_path.hasFileExtension(...eternalExts)) {
					import_path = getEternalModuleProxyPath(import_path, rootPath) as Path<Path.Protocol.File>;
				}
				const web_path = this.srcPrefix + mapped_import_path.getAsRelativeFrom(this.#base_path).slice(2) // remove ./
				const import_pseudo_path = this.scope.getChildPath(web_path);
				// const rel_import_pseudo_path = import_pseudo_path.getAsRelativeFrom(module_path.parent_dir);

				if (!no_side_effects) await this.updateBackendInterfaceFile(web_path, import_pseudo_path, import_path, module_path, imports, ignore_export_failures);

				return this.normalizeImportFileExt(web_path);
			}
	
			else if (import_type == "common") {

				for (const [path, [transpiler, web_root_path]] of this.#common_transpilers) {
					// TODO: import map update
					// console.log("common import " + import_path)
					if (import_path.isChildOf(path)) {
						// TODO: fix getDistPath for .dx files
						const web_path = web_root_path + transpiler.getDistPath(import_path, false, false)?.getAsRelativeFrom(transpiler.dist_dir).slice(2);
						// return this.normalizeImportFilExt(web_path);
						return null;
					}
				}
			}
	
			else if (import_type == "frontend") {
				// only relevant for .dx files
				if (module_type == "frontend") {
					const rel_path = mapped_import_path.getAsRelativeFrom(module_path);
					// TODO: remove? no longer needed
					// if (!no_side_effects) await this.updateDxMapFile(import_path.getAsRelativeFrom(this.scope), mapped_import_path, import_path, compat);

					// add d.ts. TODO: fill with content
					if (!no_side_effects) {
						let dts = await generateDTSModuleForRemoteAccess(rel_path);
						dts += "\n// TODO: convert static dx to d.ts\ndeclare const _default: any; export default _default;";
						const actual_path = await this.transpiler.addVirtualFile(mapped_import_path.replaceFileExtension("ts", "d.ts"), dts, true);
						this.app_options.import_map.addEntry(import_path,actual_path);
					}
					
					return this.normalizeImportFileExt(rel_path);
				}
				else if (module_type == "backend") {
					return "[ERROR: TODO resolve frontend paths from backend dir]"
				}
				// resolve from common
				else if (module_type == "common") {
					const web_path = this.srcPrefix + mapped_import_path.getAsRelativeFrom(this.#base_path).slice(2) // remove ./
					const rel_path = mapped_import_path.getAsRelativeFrom(module_path);

					// add d.ts. TODO: fill with content
					if (!no_side_effects) {
						let dts = await generateDTSModuleForRemoteAccess(rel_path);
						dts += "\n// TODO: convert static dx to d.ts\ndeclare const _default: any; export default _default;";
						const actual_path = await this.transpiler.addVirtualFile(mapped_import_path.replaceFileExtension("ts", "d.ts"), dts, true);
						this.app_options.import_map.addEntry(import_path,actual_path);
					}

					return this.normalizeImportFileExt(web_path);
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

	/**
	 * Removes the '.ts' extension from placeholder .dx.ts / .dxb.ts files 
	 */
	private normalizeImportFileExt(web_path: string) {
		return web_path.replace(/\.dx.ts$/, '.dx').replace(/\.dxb.ts$/, '.dxb')
	}

	private handleEndpointImport(specifier:string, module_path:Path, imports:Set<string>, no_side_effects:boolean) {

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
	// private async updateDxMapFile(dx_import_relative:string, ts_map_path:Path, dx_import_path?:Path, compat = false) {
	// 	const content = `import { datex } from "datex-core-legacy";\n\nconst exports = await datex.get("${dx_import_relative}");\nexport default exports;` ;
	// 	await this.transpiler.addVirtualFile(ts_map_path, content, true);
	// }


	#update_backend_promise?: Promise<any>

	private async updateBackendInterfaceFile(web_path:string, import_pseudo_path:Path.File, import_path:Path, module_path:Path, imports:Set<string>, ignore_export_failures:Set<string>|boolean = false) {

		await this.#update_backend_promise;
		let resolve_done: Function|undefined;
		this.#update_backend_promise = new Promise(resolve=>resolve_done=resolve)

		const module_path_string = module_path.toString();

		if (!this.#backend_virtual_files.has(web_path)) this.#backend_virtual_files.set(web_path, new Map())
		if (!this.#backend_virtual_files.get(web_path)!.has(module_path_string)) this.#backend_virtual_files.get(web_path)!.set(module_path_string, [new Set()])

		const used_imports = this.#backend_virtual_files.get(web_path)!;

		const ignorable_exports_before = this.findIgnorableExports(used_imports);
		const combined_imports_before = <Set<string>> new Set([...used_imports.values()].map(([imports]) => imports).reduce((a, c) => a.concat( <any>[...c] ), []))
		
		// update imports used by module
		this.#backend_virtual_files.get(web_path)!.set(module_path_string, [imports, ignore_export_failures ? (ignore_export_failures instanceof Set ? ignore_export_failures : imports) : undefined])
		
		let new_combined_imports = <Set<string>> new Set([...used_imports.values()].map(([imports]) => imports).reduce((a, c) => a.concat( <any>[...c] ), []))
		const ignorable_exports_after = this.findIgnorableExports(used_imports);

		const ignorable_exports_changed = 
			ignorable_exports_before.size != ignorable_exports_after.size || 
			[...ignorable_exports_before].some(e => !ignorable_exports_after.has(e));

		// changed is true if ignorable exports changed
		let changed = ignorable_exports_changed;

		// check if imports changed:
		const removed = new Set<string>();

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
			this.createExposeExportsFile(web_path, import_pseudo_path, import_path, module_path, new_combined_imports, removed, ignorable_exports_after)
		}

		resolve_done?.();
	}

	/**
	 * Find exports that can be ignored if they are not available
	 * @param used_imports 
	 */
	private findIgnorableExports(used_imports: Map<string, [imports: Set<string>, ignore_failure?: Set<string>]>) {
		const ignore_export_failures = new Set<string>();
		for (const [, possible_ignores] of used_imports.values()) {
			if (!possible_ignores) continue;
			for (const possible_ignore of possible_ignores) {
				// already allowed to ignore
				if (ignore_export_failures.has(possible_ignore)) continue;
				// check if import is not used by any other module where failures can't be ignored
				let can_ignore = true;
				for (const [other_imports, other_possible_ignores] of used_imports.values()) {
					if (other_imports.has(possible_ignore) && !other_possible_ignores?.has(possible_ignore)) {
						can_ignore = false;
						break;
					}
				}
				if (can_ignore) ignore_export_failures.add(possible_ignore);
			}
		}
		return ignore_export_failures
	}

	private intersect<T>(...sets:Set<T>[]): Set<T> {
		if (!sets.length) return new Set();
		const i = sets.reduce((m, s, i) => s.size < sets[m].size ? i : m, 0);
		const [smallest] = sets.splice(i, 1);
		const res = new Set<T>();
		for (const val of smallest) {
			if (sets.every(s => s.has(val))) res.add(val);
		}
		return res;
	}

	#exposingFunctions = new Map<string, ()=>void>()

	private createExposeExportsFile(web_path:string, import_pseudo_path:Path.File, import_path:Path, module_path:Path, newImports:Set<string>, removedImports:Set<string>, ignore_export_failures:Set<string>|boolean = false) {
		// task to run after 300ms to create backend exports file, gets canceled if new backend exports are available
		const expose = async () => {
			// still the latests exposing function, otherwise cancel
			if (this.#exposingFunctions.get(web_path.toString()) !== expose) {
				return;
			}
			this.#logger.info(`exposed exports from ${this.getShortPathName(import_path)}: ${newImports.size ? `\n#color(green)  + ${[...newImports].join(", ")}` :' '}${removedImports.size ? `\n#color(red)  - ${[...removedImports].join(", ")}` : ''}`)
			await this.createTypescriptInterfaceFiles(web_path, import_path, import_pseudo_path, module_path, newImports, ignore_export_failures)
			
			// only delete if still the latest exposing function
			if (this.#exposingFunctions.get(web_path.toString()) === expose) {
				this.#exposingFunctions.delete(web_path.toString());
			}
		}
		this.#exposingFunctions.set(web_path.toString(), expose)
		setTimeout(expose, 300);
	}


	// create ts + d.ts interface file for ts/dx/dxb file and try to update import map
	private async createTypescriptInterfaceFiles(web_path:string, import_path_or_specifier:Path|string, import_pseudo_path:Path.File, module_path:Path, imports:Set<string>, ignore_export_failures:Set<string>|boolean = false){
		const {ts, dts} = await this.generateTypeScriptInterface(import_path_or_specifier, web_path.replace(new RegExp(String.raw`^${this.srcPrefixRegex}`), '').replace(/.dx.ts$/, '.dx').replace(/.dxb.ts$/, '.dxb'), module_path, imports, ignore_export_failures);
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
	private async generateTypeScriptInterface(path_or_specifier:Path|string, web_path:string, module_path:Path, exports:Set<string>, ignore_export_failures:Set<string>|boolean = false) {
		const is_dx = typeof path_or_specifier == "string" || path_or_specifier.hasFileExtension("dx", "dxb");

		// create ts
		if (is_dx) exports = new Set(['default', ...exports]); // add default for DATEX modules
		const ts = await generateTSModuleForRemoteAccess(path_or_specifier, exports, true, web_path, this.getShortPathName(module_path), ignore_export_failures);

		// create d.ts for dx file
		const dts = is_dx ? await generateDTSModuleForRemoteAccess(path_or_specifier, undefined, web_path, this.getShortPathName(module_path), ignore_export_failures) : null;

		return {ts, dts};
	}
	

	private async getAllExportNames(path:Path|string) {
		try {
			const module = await datex.get(path);
			const dx_type = Datex.Type.ofValue(module)
			const names = module && (dx_type == Datex.Type.std.Object || dx_type == Datex.Type.js.NativeObject) ? Object.keys(module) : [];
			return new Set(names);
		}
		catch { // network error, etc., TODO: warning somewhere
			return new Set<string>(); 
		}
	}


	// also provides hot reloading, but without loading unyt core in frontend
	private async createStaticLiveScript() {
		if (!this.server) return;

		this.#logger.success("hot reloading enabled");
		const script = `
${"import"} {BackgroundRunner} from "uix/background-runner/background-runner.ts";
if (!window.location.origin.endsWith(".unyt.app")) {
	const runner = BackgroundRunner.get();
	runner.enableHotReloading();
}
`
		await this.transpiler.addVirtualFile(this.debugPrefix.slice(1)+"hot-reload.ts", script);
		this.#static_client_scripts.push(this.debugPrefix+"hot-reload.ts")

	}

	private async createExposeDenoScript() {
		if (!this.server) return;

		this.#logger.success("exposing Deno namespace to frontend");
		const {sharedDeno} = await import("./shared-deno.ts");

		const script = `
		${"import"} {datex} from "datex-core-legacy";
		globalThis.Deno = await datex \`${Datex.Pointer.getByValue(sharedDeno)?.idString()}\`
		`
		await this.transpiler.addVirtualFile(this.debugPrefix.slice(1)+"deno.ts", script);

		this.#client_scripts.push(this.debugPrefix+"deno.ts")
	}


	#ignore_reload = false;

	private handleFrontendReload(){
		if (!this.live) return;
		if (this.#ignore_reload) return;

		// new hot reloading via sse
		this.sendGlobalSSECommand("RELOAD");

		setTimeout(()=>this.#ignore_reload=false, 500); // wait some time until next update triggered
	}

	private getUIXContextGenerator(requestEvent: Deno.RequestEvent, path:string, conn?:Deno.Conn){
		return ()=>{
			const builder = new ContextBuilder();
			builder.setRequestData(requestEvent.request, path, conn);
			return builder.build()
		}
	}

	/**
	 * Gets the current content from the backend entrypoint
	 * @param path entrypoint path
	 * @param lang current language
	 * @param context request context
	 * @returns 
	 */
	public async getEntrypointContent(entrypoint: Entrypoint, path?: string, lang = 'en', context?:ContextGenerator|Context): Promise<[content:[string,string]|string|raw_content|null, render_method:RenderMethod, status_code?:number, open_graph_meta_tags?:OpenGraphInformation|undefined, headers?:Headers, contentElement?: Element|DocumentFragment, requiredPointers?:Set<Node>]> {
		
		// extract content from provider, depending on path
		const {content, render_method, status_code, headers} = await resolveEntrypointRoute({
			entrypoint: entrypoint,
			route: Path.Route(path), 
			context, 
			only_return_static_content: true
		});

		const openGraphData = (content as any)?.[OPEN_GRAPH];

		// raw file content
		if (content instanceof Blob || content instanceof Response) return [content, RenderMethod.RAW_CONTENT, status_code, openGraphData, headers];

		// Markdown
		if (content instanceof Datex.Markdown) return [getOuterHTML(<Element> content.getHTML(false), {
			includeShadowRoots:true, 
			injectStandaloneJS:render_method!=RenderMethod.STATIC, 
			injectStandaloneComponents:render_method!=RenderMethod.STATIC, 
			allowIgnoreDatexFunctions:(render_method==RenderMethod.HYBRID||render_method==RenderMethod.PREVIEW), 
			lang
		}), render_method, status_code, openGraphData, headers];

		// convert content to valid HTML string
		if (content instanceof Element || content instanceof DocumentFragment) {
			const requiredPointers = new Set<Node>()
			const html = getOuterHTML(
				content as Element, 
				{
					includeShadowRoots:true, 
					injectStandaloneJS:render_method!=RenderMethod.STATIC, 
					injectStandaloneComponents:render_method!=RenderMethod.STATIC, 
					allowIgnoreDatexFunctions:(render_method==RenderMethod.HYBRID||render_method==RenderMethod.PREVIEW), 
					lang,
					requiredPointers
				}
			);
			return [html, render_method, status_code, openGraphData, headers, content as Element, requiredPointers];
		}
		
		// invalid content was created, should not happen
		else if (content && typeof content == "object") {
			console.log("invalid UIX content:", content)
			const [status_code, html] = createErrorHTML(`Cannot render content type`, 500);
			return [getOuterHTML(html, {includeShadowRoots:true, lang}), RenderMethod.STATIC, status_code, undefined];
		}
		else return [content ? domUtils.escapeHtml(content.toString() ?? "") : null, render_method, status_code, openGraphData, headers];
	}

	private async handleRequest(requestEvent: Deno.RequestEvent, path:string, conn:Deno.Conn, metadata:requestMetadata, entrypoint = this.#backend?.content_provider, recursiveError = true) {
		const url = new Path(requestEvent.request.url);

		const pathAndQueryParameters = url.normal_pathname + url.search;
		const lang = ContextBuilder.getRequestLanguage(requestEvent.request);

		const port = new URL(requestEvent.request.url).port;
		const isSafariLocalhost = url.hostname == "localhost" && isSafariClient(requestEvent.request);

		const isInlineRendered = requestEvent.request.headers.get("UIX-Inline-Backend") == "true"

		try {
			this.updateCheckEntrypoint();

			const [
				prerendered_content, 
				render_method, 
				status_code, 
				open_graph_meta_tags, 
				headers, 
				contentElement, 
				requiredPointers
			] = entrypoint ? await this.getEntrypointContent(entrypoint, pathAndQueryParameters, lang, this.getUIXContextGenerator(requestEvent, path, conn)) : [];

			// empty backend route & UIX-Inline-Backend => return 400 and just render frontend route
			if (isInlineRendered && render_method == RenderMethod.DYNAMIC && prerendered_content==null) {
				try {
					await this.server.sendError(requestEvent, 300, "IS_FRONTEND_ROUTE");
				}
				catch {/* ignore*/}
				return;
			}

			// serve raw content (Blob or HTTP Response)
			if (prerendered_content && render_method == RenderMethod.RAW_CONTENT) {
				if (prerendered_content instanceof Response) await requestEvent.respondWith(prerendered_content.clone());
				else await this.server.serveContent(requestEvent, typeof prerendered_content == "string" ? "text/plain;charset=utf-8" : (<any>prerendered_content).type, <any>prerendered_content, undefined, status_code, headers);
			}

			// serve normal page
			else {
				const entrypoint_css = [this.getEntrypointCSS(this.scope)];
				if (this.#backend) entrypoint_css.push(this.getEntrypointCSS(this.#backend.scope))
	
				const combinedHeaders = headers ?? new Headers();
				combinedHeaders.set('content-language', lang)

				let themeDark = getCookie(UIX_COOKIE.themeDark, requestEvent.request.headers, port)
				let themeLight = getCookie(UIX_COOKIE.themeLight, requestEvent.request.headers, port)
				let mode = (getCookie(UIX_COOKIE.colorMode, requestEvent.request.headers, port) || getCookie(UIX_COOKIE.initialColorMode, requestEvent.request.headers, port)) as "dark"|"light"

				// no mode cookie or invalid, set server default (uix-initial-color-mode)
				if (mode && mode !== "dark" && mode !== "light") {
					logger.warn(`Invalid color mode set on frontend, using "${UIX.Theme.mode}" as a fallback`);
					mode = UIX.Theme.mode
					setCookie(UIX_COOKIE.initialColorMode, mode, undefined, combinedHeaders, port, isSafariLocalhost);
				}
				else if (!mode) {
					mode = UIX.Theme.mode
					setCookie(UIX_COOKIE.initialColorMode, mode, undefined, combinedHeaders, port, isSafariLocalhost);
				}

				// select matching light theme for mode
				const currentDarkThemeCSS = themeDark ? UIX.Theme.getThemeCSS(themeDark, true) : undefined;
				const currentLightThemeCSS = themeLight ? UIX.Theme.getThemeCSS(themeLight, true) : undefined;

				// fall back to default dark theme
				if (!currentDarkThemeCSS) {
					if (themeDark) logger.warn(`Theme "${themeDark}" is not registered on the backend, using "${UIX.Theme.defaultDarkTheme}" as a fallback`);
					setCookie(UIX_COOKIE.themeDark, UIX.Theme.defaultDarkTheme, undefined, combinedHeaders, port, isSafariLocalhost);
					themeDark = UIX.Theme.defaultDarkTheme
				}

				// fall back to default light theme
				if (!currentLightThemeCSS) {
					if (themeLight) logger.warn(`Theme "${themeLight}" is not registered on the backend, using "${UIX.Theme.defaultLightTheme}" as a fallback`);
					setCookie(UIX_COOKIE.themeLight, UIX.Theme.defaultLightTheme, undefined, combinedHeaders, port, isSafariLocalhost);
					themeLight = UIX.Theme.defaultLightTheme
				}

				const preferredThemeName = mode == "dark" ? themeDark! : themeLight!;

				// get stylesheets for theme
				const currentThemeCSS = preferredThemeName ? UIX.Theme.getThemeCSS(preferredThemeName, true) : undefined;
				const currentThemeStylesSheets = UIX.Theme.getThemeStylesheets(preferredThemeName) ?? [];
				const currentDarkThemeAppColor = UIX.Theme.getTheme(themeDark!)?.appColor;
				const currentLightThemeAppColor = UIX.Theme.getTheme(themeLight!)?.appColor;

				// get live pointer ids for sse observer
				let liveNodePointers:string[]|undefined = undefined;
				if (contentElement && render_method === RenderMethod.BACKEND) {
					liveNodePointers = getLiveNodes(contentElement, false).map(e => Datex.Pointer.getByValue(e)?.id).filter(e=>!!e);
				}

				// give pointer read permissions for hydratable nodes / other required pointers to client endpoint
				if (Datex.Runtime.OPTIONS.PROTECT_POINTERS) {
					if (requiredPointers && metadata.endpoint) {
						for (const val of requiredPointers) {
							try {
								// grant access to whole pointer if pointer property (TODO: property level access)
								if (val instanceof Datex.PointerProperty) grantAccess((val as Datex.PointerProperty).pointer, metadata.endpoint.main)
								// grant normal access
								else grantAccess(val, metadata.endpoint.main)
							}
							catch (e) {
								console.error(e)
							}
						}
					}
				}
				

				await this.server.serveContent(
					requestEvent, 
					"text/html", 
					await generateHTMLPage({
						provider: this,
						prerendered_content: (prerendered_content??"") as string,
						render_method,
						js_files: this.#client_scripts,
						lang,
						static_js_files: this.#static_client_scripts,
						color_scheme: mode,
						css: currentThemeCSS,
						global_css_files: ['uix/style/document.css', ...currentThemeStylesSheets.map(s=>({href:s, class:"custom-theme"})), ...entrypoint_css],
						body_css_files: ['uix/style/body.css', ...entrypoint_css],
						frontend_entrypoint: this.#entrypoint,
						backend_entrypoint: this.#backend?.web_entrypoint,
						open_graph_meta_tags,
						livePointers: liveNodePointers,
						includeImportMap: !isInlineRendered,
						preloadDependencies: this.app_options.preload_dependencies,
						appColors: {dark: currentDarkThemeAppColor, light: currentLightThemeAppColor}
					}),
					undefined, status_code, combinedHeaders
				);
			}
		} catch (error) {
			console.log(error)
			if (recursiveError) {
				await this.handleRequest(requestEvent, path, conn, metadata, error, false);
			}
			else this.server.sendError(requestEvent, 500);
		}
	}

	private async serveUIXPage(requestEvent: Deno.RequestEvent, scriptPath: string) {
		await this.server.serveContent(requestEvent, "text/html", await generateHTMLPage({
			provider: this,
			prerendered_content: "",
			render_method: RenderMethod.DYNAMIC,
			js_files: [...this.#client_scripts, scriptPath],
			static_js_files: this.#static_client_scripts,
			global_css_files: ['uix/style/document.css'],
			body_css_files: ['uix/style/body.css'],
			color_scheme: "dark",
			force_enable_scripts: true,
			preloadDependencies: this.app_options.preload_dependencies
		}));
	}

	private async handleServiceWorker(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			const path = new Path(this.resolveImport('uix/sw/sw.ts', true, false), this.base_path);
			await this.server.serveContent(requestEvent, "text/javascript", await path.getTextContent());
		} catch {
			await this.server.sendError(requestEvent, 500);
		}			
	}

	private async handleThreadWorker(requestEvent: Deno.RequestEvent, _path:string) {
		const url = import.meta.resolve("datex-core-legacy/threads/thread-worker.ts");
		const request = new Request(url, {headers: requestEvent.request.headers})
		requestEvent.respondWith(await fetch(request));		
	}

	private async handleInitPage(requestEvent: Deno.RequestEvent) {
		try {

			const html = `<html>
			INIT...
			<script type="module" src="${import.meta.resolve('uix/session/init.ts')}"></script>
			`
			await this.server.serveContent(requestEvent, "text/html", html);
		} catch {
			await this.server.sendError(requestEvent, 500);
		}	
	}

	private async handleFavicon(requestEvent: Deno.RequestEvent, _path:string) {
		try {
			const path = new Path(this.resolveImport(this.app_options.icon, true, false), this.base_path);
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

	#manifest?: Record<string, any>;

	private generateManifest() {
		this.#manifest = {
			"name": this.app_options.name,
			"description": this.app_options.description,
			"default_locale": "en",
			"version": this.app_options.version,
			"icons": [
			  {
				"src": this.resolveImport(this.app_options.icon),
				"sizes": "287x287",
				"type": "image/png"
			  }
			],
			"start_url": "/",
			"display": "standalone",
			"display_override": ["window-controls-overlay"],
			"theme_color": "#111111",
			"manifest_version": 2,
			"permissions": ["webNavigation", "unlimitedStorage"]
		}

		// custom manifest overrides
		if (this.app_options.manifest) {
			Object.assign(this.#manifest, this.app_options.manifest)
		}
	}
	

	private async handleManifest(requestEvent: Deno.RequestEvent, _path:string) {
		if (!this.#manifest) this.generateManifest();
		try {
			await this.server.serveContent(requestEvent, "application/json", JSON.stringify(this.#manifest));
		} catch {
			await this.server.sendError(requestEvent, 500);
		}			
	}

}