import { Datex, f } from "unyt_core";

import { FrontendManager } from "./frontend_manager.ts";
import { BackendManager } from "./backend_manager.ts";
import { endpoint_config } from "unyt_core/runtime/endpoint_config.ts";
import { Path } from "unyt_node/path.ts";
import { Server } from "unyt_node/server.ts";
import { UIX_CACHE_PATH } from "../utils/constants.ts";
import type { app_options, normalized_app_options } from "./options.ts";

let live_frontend:boolean|undefined = false;
let watch:boolean|undefined = false;
let watch_backend:boolean|undefined = false;
let http_over_datex: boolean|undefined = true;
let stage = '?'

if (globalThis.Deno) {
	({ stage, live_frontend, watch, watch_backend, http_over_datex } = (await import("../utils/args.ts")))
}

const logger = new Datex.Logger("UIX App");


export const ALLOWED_ENTRYPOINT_FILE_NAMES = ['entrypoint.dx', 'entrypoint.ts', 'entrypoint.tsx']



class UIXApp {

	base_url?:URL

	options?:normalized_app_options

	frontends = new Map<string, FrontendManager>()
	#ready_handlers = new Set<()=>void>();
	#ready = false;

	defaultServer?: Server

	get stage(){
		return stage;
	}

	public onReady(handler:()=>void) {
		if (this.#ready) handler();
		else this.#ready_handlers.add(handler);
	}

	public ready = new Promise<void>(resolve=>this.onReady(()=>resolve()))

	/**
	 * resolves file paths to web paths, keep everything else (web urls, import aliases)
	 * @param filePath file path (e.g. "file://", "./xy", "/xy")
	 * @returns web path (e.g. "/@uix/src/xy")
	 */
	public filePathToWebPath(filePath:URL|string, includeDefaultDomain = false){
		// keep import aliases
		if (typeof filePath == "string" && !(filePath.startsWith("./")||filePath.startsWith("../")||filePath.startsWith("/")||filePath.startsWith("file://"))) return filePath;

		// already a web path
		if (Path.pathIsURL(filePath) && new Path(filePath).is_web) return filePath.toString();

		if (!this.base_url) throw new Error("Cannot convert file path to web path - no base file path set");
		const path = new Path(filePath, this.base_url);

		// is /@uix/cache
		if (path.isChildOf(UIX_CACHE_PATH)) return (includeDefaultDomain ? this.getDefaultDomainPrefix() : '') + path.getAsRelativeFrom(UIX_CACHE_PATH).replace(/^\.\//, "/@uix/cache/");
		// is /@uix/src
		else return (includeDefaultDomain ? this.getDefaultDomainPrefix() : '') + path.getAsRelativeFrom(this.base_url).replace(/^\.\//, "/@uix/src/")
	}

	public getDefaultDomainPrefix() {
		return Datex.Unyt.endpointDomains()[0] ?? '';
	}

	public async start(options:app_options = {}, base_url?:string|URL) {

		// prevent circular dependency problems
		const {normalizeAppOptions} = await import("./options.ts")

		const [n_options, new_base_url] = await normalizeAppOptions(options, base_url);
		this.options = n_options;
		this.base_url = new_base_url;

		// logger.info("options", {...n_options})

		// for unyt log
		Datex.Unyt.setAppInfo({name:n_options.name, version:n_options.version, stage:stage, host:Deno.env.has("UIX_HOST_ENDPOINT") ? f(Deno.env.get("UIX_HOST_ENDPOINT") as any) : undefined, domains: Deno.env.get("UIX_HOST_DOMAINS")?.split(",")})

		// set .dx path to backend
		if (n_options.backend.length) {
			await endpoint_config.load(new URL("./.dx", n_options.backend[0]))
		}

		// connect to supranet
		if (endpoint_config.connect !== false) await Datex.Supranet.connect();
		else await Datex.Supranet.init();

		// TODO: map multiple backends to multiple frontends?
		let backend_with_default_export:BackendManager|undefined;

		// load backend
		for (const backend of n_options.backend) {
			const backend_manager = new BackendManager(n_options, backend, this.base_url, watch_backend);
			await backend_manager.run()
			if (backend_manager.content_provider!=undefined) {
				if (backend_with_default_export!=undefined) logger.warn("multiple backend entrypoint export a default content");
				backend_with_default_export = backend_manager; 
			}
		}

		// also override endpoint default
		if (backend_with_default_export) Datex.Runtime.endpoint_entrypoint = backend_with_default_export.content_provider;


		let server:Server|undefined
		// load frontend
		for (const frontend of n_options.frontend) {
			const frontend_manager = new FrontendManager(n_options, frontend, this.base_url, backend_with_default_export, watch, live_frontend)
			await frontend_manager.run();
			server = frontend_manager.server;
			this.frontends.set(frontend.toString(), frontend_manager);
		}
		// no frontend, but has backend with default export -> create empty frontend
		if (!n_options.frontend.length && backend_with_default_export) {
			// TODO: remove tmp dir on exit
			const dir = new Path(Deno.makeTempDirSync()).asDir();
			const frontend_manager = new FrontendManager(n_options, dir, this.base_url, backend_with_default_export, watch, live_frontend)
			await frontend_manager.run();
			server = frontend_manager.server;
		}

		// expose DATEX interfaces
		// TODO: also enable without connect == false (For all uix servers), working, but routing problems
		if (server && endpoint_config.connect === false) {
			const DatexServer = (await import("unyt_node/datex_server.ts")).DatexServer
			DatexServer.addInterfaces(["websocket", "webpush"], server);
			// also add custom .dx file
			const data = new Map<Datex.Endpoint, {channels:Record<string,string>,keys:[ArrayBuffer, ArrayBuffer]}>();
			data.set(Datex.Runtime.endpoint,  {
				channels: {
					'websocket': '##location##'
				},
				keys: Datex.Crypto.getOwnPublicKeysExported()
			})
			server.path("/.dx", Datex.Runtime.valueToDatexStringExperimental(new Datex.Tuple({nodes:data}), true).replace('"##location##"', '#location'), 'text/datex')
		}


		// enable HTTP-over-DATEX
		if (server && http_over_datex) {
			const {HTTP} = await import("./http_over_datex.ts")
			HTTP.setServer(server);
		}

		this.defaultServer = server;
		
		try {
			for (const handler of this.#ready_handlers) await handler();
		}
		catch {}
		this.#ready = true;

	}

}

export function getDirType(app_options:normalized_app_options, path:Path) {	
	// backend path?
	for (const backend of app_options.backend) {
		if (path.isChildOf(backend)) return 'backend'
	}

	// frontend path?
	for (const frontend of app_options.frontend) {
		if (path.isChildOf(frontend)) return 'frontend'
	}

	// common path?
	for (const common of app_options.common) {
		if (path.isChildOf(common)) return 'common'
	}
}


export function urlToPath(url:string|URL){
	if (typeof url == "string" && url.startsWith("/")) return url;
	else return url.toString().replace("file://","");
}

export function validateDirExists(url:URL, type:string) {
	let dir = false;
	try {
		if (!Deno.statSync(url).isFile) dir = true;
	}
	catch {
		logger.error("The specified "+type+" directory '"+url+"' does not exist.");
		throw new Error("UIX App initialization failed");
	}
	if (!dir) {
		logger.error("The specified "+type+" path '"+url+"' is not a directory.");
		throw new Error("UIX App initialization failed");
	}
}


export const App = new UIXApp();