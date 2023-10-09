import { Datex, f } from "unyt_core";

import { FrontendManager } from "./frontend-manager.ts";
import { BackendManager } from "./backend-manager.ts";
import { endpoint_config } from "unyt_core/runtime/endpoint_config.ts";
import { Path } from "../utils/path.ts";
import { ImportMap } from "../utils/importmap.ts";
import { Server } from "../server/server.ts";

import type { appOptions, normalizedAppOptions } from "./options.ts";
import { client_type } from "unyt_core/utils/constants.ts";
import { State } from "../base/state.ts";

const logger = new Datex.Logger("UIX App");
export const ALLOWED_ENTRYPOINT_FILE_NAMES = ['entrypoint.dx', 'entrypoint.ts', 'entrypoint.tsx']


// options passed in via command line arguments
let live_frontend:boolean|undefined = false;
let watch:boolean|undefined = false;
let watch_backend:boolean|undefined = false;
let http_over_datex: boolean|undefined = true;
let stage: string|undefined

if (client_type === "deno") {
	({ stage, live_frontend, watch, watch_backend, http_over_datex } = (await import("./args.ts")))
}


class UIXApp {

	base_url?:URL

	options?:normalizedAppOptions

	frontends = new Map<string, FrontendManager>()
	#ready_handlers = new Set<()=>void>();
	#ready = false;

	/**
	 * The default web server instance (there might be multiple web server instances if there is more than one backend)
	 */
	defaultServer?: Server

	/**
	 * Current deployment stage, default is 'dev'
	 */
	get stage(){
		return stage ?? State.APP_META.stage;
	}

	#uniqueStartId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
		.replace(/[xy]/g, function (c) {
			const r = Math.random() * 16 | 0, 
				v = c == 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});

	get uniqueStartId() {
		return this.#uniqueStartId
	}

	/**
	 * find a transpiler that can transpile files for a given path
	 * @param path
	 * @returns 
	 */
	getTranspilerForPath(path: Path.File) {
		for (const frontend of this.frontends.values()) {
			const transpiler = frontend.getTranspilerForPath(path);
			if (transpiler) return transpiler;
		}
	}

	/**
	 * Register a callback function that is called when the app is fully loaded
	 * @param handler 
	 */
	public onReady(handler:()=>void) {
		if (this.#ready) handler();
		else this.#ready_handlers.add(handler);
	}

	/**
	 * Resolved when the app is fully loaded
	 * Dont await this in top level of a backend module!
	 */
	public ready = new Promise<void>(resolve=>this.onReady(()=>resolve()))

	#domains?: string[]

	/**
	 * A list of all known domains for this app instance, sorted by priority
	 * 
	 * This includes auto-generated *.unyt.app domains
	 */
	public get domains() {
		if (!this.#domains) {
			// custom host domains
			const domains = Deno.env.get("UIX_HOST_DOMAINS")?.split(",") ?? [];

			// TODO: use this in the unyt core status logger, currently implemented twice
			// app domains inferred from current endpoint
			const urlEndpoint = Datex.Runtime.endpoint;
			const endpointURLs = urlEndpoint ? [this.formatEndpointURL(urlEndpoint)].filter(v=>!!v) as string[] : [];

			this.#domains = [...new Set([...domains, ...endpointURLs])];
		}

		return this.#domains!;
	}

	public formatEndpointURL(endpoint:Datex.Endpoint) {
        const endpointName = endpoint.toString();
        if (endpointName.startsWith("@+")) return `${endpointName.replace("@+","")}.unyt.app`
        else if (endpointName.startsWith("@@")) return `${endpointName.replace("@@","")}.unyt.app`
        else if (endpointName.startsWith("@")) return `${endpointName.replace("@","")}.unyt.me`
    }

	public async start(options:appOptions = {}, base_url?:string|URL) {

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
		else await Datex.Supranet.init(undefined);

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
			this.frontends.set(dir.toString(), frontend_manager);
		}

		// expose DATEX interfaces
		// TODO: also enable without connect == false (For all uix servers), working, but routing problems
		if (server && endpoint_config.connect === false) {
			const DatexServer = (await import("../server/datex_server.ts")).DatexServer
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
			const {HTTP} = await import("./http-over-datex.ts")
			HTTP.setServer(server);
		}

		this.defaultServer = server;
		
		this.#ready = true;
		for (const handler of this.#ready_handlers) await handler();
	}

}


/**
 * The currrent UIXApp, accessible on a client or on the backend
 */
export const app = new UIXApp();

// @ts-ignore use pre injected uix app metadata
if (globalThis._UIX_import_map && !app.options) {
	// @ts-ignore use pre injected uix app metadata
	app.options = {import_map: new ImportMap(globalThis._UIX_import_map)}
}