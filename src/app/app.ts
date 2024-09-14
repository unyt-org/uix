import { Datex, f } from "datex-core-legacy/mod.ts";

import type { FrontendManager  } from "./frontend-manager.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { ImportMap } from "../utils/importmap.ts";
import type { Server } from "../server/server.ts";

import type { appOptions, normalizedAppOptions } from "./options.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { displayInit } from "datex-core-legacy/runtime/display.ts";
import { ServiceWorker } from "../sw/sw-installer.ts";
import { logger } from "../utils/global-values.ts";
import { endpoint_config } from "datex-core-legacy/runtime/endpoint_config.ts";
import { getInjectedAppData, getInjectedImportmap } from "./app-data.ts";

import { addUIXNamespace } from "../base/uix-datex-module.ts"
import "../../uix-short.ts"

import "../base/init.ts"
import { bindingOptions } from "./dom-context.ts";
import { convertToWebPath } from "./convert-to-web-path.ts";
import { UIX_COOKIE, deleteCookie } from "../session/cookies.ts";
import { UIX } from "../../uix.ts";
import { formatEndpointURL } from "datex-core-legacy/utils/format-endpoint-url.ts";

import wasm_init, {init_runtime } from "datex-core-legacy/wasm/adapter/pkg/datex_wasm.js";

export const ALLOWED_ENTRYPOINT_FILE_NAMES = ['entrypoint.dx', 'entrypoint.ts', 'entrypoint.tsx']

type version_change_handler = (version:string, prev_version:string)=>void|Promise<void>;

await addUIXNamespace();

// options passed in via command line arguments
let stage: string|undefined
let http_over_datex: boolean|undefined
let enable_datex_cli: boolean|undefined;
if (client_type === "deno") {
	({ stage, http_over_datex, enable_datex_cli } = (await import("./args.ts" /*lazy*/)))
}

// enable DATEX CLI
if (enable_datex_cli && client_type === "deno") Datex.enableCLI();

const version = eternal ?? $$("unknown");


export type appMetadata = {
	name?: string,
	description?: string,
	version?: string,
	stage?: string,
	backend?: Datex.Endpoint,
	backendLibVersions?: {uix: string, datex: string},
	usid?: string,
	hod?: boolean // is http-over-datex enabled?
}

class App {

	constructor() {
		// get import map from <script type=importmap>
		const importMapContent = getInjectedImportmap()
		if (importMapContent) {
			// @ts-ignore use pre injected import map
			this.options = {import_map: new ImportMap(importMapContent)}
		}

		// set app meta data
		if (client_type == "deno") {
			// todo set default metadata on backend
			this.#setMetadata({
				hod: http_over_datex
			})
		}

		// get injected uix app metadata
		else {
			const appDataContent = getInjectedAppData()
			if (appDataContent) {
				const appdata: Record<string,any> = {...appDataContent}
				if (appdata.backend) {
					appdata.backend = f(appdata.backend)

					// add backend as trusted endpoints with full permissions
					Datex.Runtime.addTrustedEndpoint(appdata.backend.main, [
						"protected-pointer-access", 
						"remote-js-execution",
						"fallback-pointer-source"
					])
				};
				if (appdata.host) appdata.host = f(appdata.host);
				if (appdata.experimental_features && this.options) {
					if (!this.options.experimental_features) this.options.experimental_features = [];
					this.options.experimental_features.push(...appdata.experimental_features);
				}
				this.#setMetadata(appdata)
			}
		}
		
	}

	base_url!:URL

	options?:normalizedAppOptions

	frontends = new Map<string, FrontendManager>()
	#ready_handlers = new Set<()=>void>();
	#ready = false;

	#metadata: appMetadata = {}

	/**
	 * The default web server instance (there might be multiple web server instances if there is more than one backend)
	 */
	defaultServer?: Server

	/**
	 * Current deployment stage, default is 'dev'
	 */
	get stage(){
		return stage ?? this.metadata.stage;
	}

	get version() {
		return version;
	}

	get metadata() {
		return this.#metadata
	}

	get backend() {
		return this.#metadata.backend
	}

	#setMetadata(metadata:appMetadata) {
		Object.assign(this.#metadata, metadata);
        Datex.Unyt.setAppInfo(metadata)
	      
        if (metadata.version) {
            const prev_version = version.val;
            version.val = metadata.version;
            if (prev_version != "unknown" && prev_version != version.val) this.#handleVersionChange(prev_version, version.val)
        }
	}

	#uniqueStartId = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
		.replaceAll('x', function (c) {
			const r = Math.random() * 16 | 0, 
				v = c == 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});

	get uniqueStartId() {
		return this.metadata.usid ?? this.#uniqueStartId
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

	#current_version_change_handler: version_change_handler|undefined;
    #waiting_version_change: Function|undefined;

	/**
	 * Register a handler that gets called when the app is loaded with a new version
	 * @param handler
	 */
    onVersionChange(handler:version_change_handler) {
        this.#current_version_change_handler = handler;
        if (this.#waiting_version_change) this.#waiting_version_change();
    }

    #handleVersionChange(from:string, to:string) {
        this.#waiting_version_change = async ()=> {
            if (!this.#waiting_version_change) return;
            this.#waiting_version_change = undefined;
            displayInit("Updating App");
            logger.info("app version changed from " + from + " to " + to);
            await ServiceWorker.clearCache();
            if (this.#current_version_change_handler) await this.#current_version_change_handler(from, to);
            window.location.reload();
        }
        if (this.#current_version_change_handler) this.#waiting_version_change(); // call if handler available
        // show ui
        displayInit("Updating App");

        // update if no handler called after some time
        setTimeout(()=>this.#waiting_version_change?.(), 8000);
    }

	/**
	 * Resolved when the app is fully loaded
	 * Dont await this in top level of a backend module!
	 */
	public ready = new Promise<void>(resolve=>this.onReady(()=>resolve()))

	#domains?: string[]

	/**
	 * A list of all known domains for this app instance, sorted by priority
	 * This includes auto-generated *.unyt.app domains
	 */
	public get domains() {
		if (!this.#domains) {
			// TODO: use this in the unyt core status logger, currently implemented twice
			// app domains inferred from current endpoint
			const urlEndpoint = this.metadata.hod === false ? null : Datex.Runtime.endpoint.main;
			const endpointURLs = urlEndpoint ? [formatEndpointURL(urlEndpoint)].filter(v=>!!v) as string[] : [];

			this.#domains = [...new Set([...this.hostDomains, ...endpointURLs])];
		}

		return this.#domains!;
	}

	#hostDomains?: string[]

	/**
	 * A list of all known domains for this app instance, assigned by the host.
	 * It is assumed that the host will directly forward all requests to these domains to the current endpoint.
	 */
	public get hostDomains() {
		if (!this.#hostDomains) {
			this.#hostDomains = globalThis.Deno?.env.get("UIX_HOST_DOMAINS")?.split(",").filter(v=>!!v) ?? [];
		}
		return this.#hostDomains;
	}

	public async start(options:appOptions = {}, originalBaseURL?:string|URL) {
		const { startApp } = await import("./start-app.ts" /*lazy*/);
		const {nOptions, baseURL, defaultServer, frontends} = await startApp(this, options, originalBaseURL)
		this.options = nOptions;
		this.defaultServer = defaultServer;
		this.base_url = baseURL;
		this.frontends = frontends;

		// log enabled experimental features
		const allowedFeatures = ['indirect-references', 'view-transitions'];
		for (const feature of this.options.experimental_features) {
			if (allowedFeatures.includes(feature)) logger.info(`experimental feature "${feature}" enabled`)
			else logger.error(`unknown experimental feature "${feature}"`)
		}
		
		this.#ready = true;
		for (const handler of this.#ready_handlers) await handler();	
	}


	async reset(resetEndpoint = false) {
		if (resetEndpoint) endpoint_config.clear();
		localStorage.clear();
		sessionStorage.clear();

		// clear cookies
		deleteCookie(UIX_COOKIE.endpoint)
		deleteCookie(UIX_COOKIE.endpointNonce)
		deleteCookie(UIX_COOKIE.endpointValidation)
		deleteCookie(UIX_COOKIE.session)
		deleteCookie(UIX_COOKIE.unverifiedSession)
		deleteCookie(UIX_COOKIE.language)
		deleteCookie(UIX_COOKIE.sharedData)
		deleteCookie(UIX_COOKIE.themeDark)
		deleteCookie(UIX_COOKIE.themeLight)
		deleteCookie(UIX_COOKIE.colorMode)

        // reset service worker
        await ServiceWorker.clearCache();

        // clear storage
        await Datex.Storage.clearAndReload();
    }

}


/**
 * The currrent UIXApp, accessible on a client or on the backend
 */
export const app = new App();

// reset key shortcut

// if (app.stage == "dev")  TODO: only in dev stage?
(globalThis as any).addEventListener("keydown", (e:any) => {
	if (e.code == "KeyR" && e.ctrlKey) app.reset();
	else if (e.code == "KeyL" && e.ctrlKey) {
		if (UIX.language == "en") UIX.language = "de"
		else UIX.language = "en";
		console.log("[Debug] Switched language to '" + UIX.language + "'")
	}
	else if (e.code == "KeyT" && e.ctrlKey) {
		if (UIX.Theme.mode == "dark") UIX.Theme.mode = "light"
		else UIX.Theme.mode = "dark";
		console.log("[Debug] Switched theme to '" + UIX.Theme.mode + "'")
	}
})

if (app.stage !== "dev") {
	// don't expose native error stack traces via DATEX
	Datex.Runtime.OPTIONS.NATIVE_ERROR_STACK_TRACES = false
}

// load DATEX WASM / Decompiler, only in backend by default
if (client_type === "deno") {
	await wasm_init();
	init_runtime();
}

bindingOptions.mapFileURL = (url) => {
	return convertToWebPath(url);
}