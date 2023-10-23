import { Datex, f } from "datex-core-legacy";

import type { FrontendManager  } from "./frontend-manager.ts";
import { Path } from "../utils/path.ts";
import { ImportMap } from "../utils/importmap.ts";
import type { Server } from "../server/server.ts";

import type { appOptions, normalizedAppOptions } from "./options.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { displayInit } from "datex-core-legacy/runtime/display.ts";
import { ServiceWorker } from "../sw/sw-installer.ts";
import { logger } from "../utils/global-values.ts";
import { endpoint_config } from "datex-core-legacy/runtime/endpoint_config.ts";
import { getInjectedAppData, getInjectedImportmap } from "./app-data.ts";

import "../base/uix-datex-module.ts"

import "../base/init.ts"
import { bindingOptions } from "./dom-context.ts";
import { convertToWebPath } from "./convert-to-web-path.ts";


export const ALLOWED_ENTRYPOINT_FILE_NAMES = ['entrypoint.dx', 'entrypoint.ts', 'entrypoint.tsx']

type version_change_handler = (version:string, prev_version:string)=>void|Promise<void>;


// options passed in via command line arguments
let stage: string|undefined
if (client_type === "deno") {
	({ stage } = (await import("./args.ts")))
}

const version = eternal ?? $$("unknown");


export type appMetadata = {
	name?: string,
	description?: string,
	version?: string,
	stage?: string,
	backend?: Datex.Endpoint,
	usid?: string
}

class App {

	constructor() {
		// get import map from <script type=importmap>
		const importMapContent = getInjectedImportmap()
		if (importMapContent) {
			// @ts-ignore use pre injected import map
			this.options = {import_map: new ImportMap(importMapContent)}
		}

		// get injected uix app metadata
		const appDataContent = getInjectedAppData()
		if (appDataContent) {
			const appdata: Record<string,any> = {...appDataContent}
			if (appdata.backend) {
				appdata.backend = f(appdata.backend)
				Datex.Runtime.addPermissionForRemoteJSCode(appdata.backend)
			};
			if (appdata.host) appdata.host = f(appdata.host);
			this.#setMetadata(appdata)
		}
	}

	base_url?:URL

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

	#setMetadata(metadata:appMetadata) {
		Object.assign(this.#metadata, metadata);
        Datex.Unyt.setAppInfo(metadata)
	      
        if (metadata.version) {
            const prev_version = version.val;
            version.val = metadata.version;
            if (prev_version != "unknown" && prev_version != version.val) this.#handleVersionChange(prev_version, version.val)
        }
	}

	#uniqueStartId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
		.replace(/[xy]/g, function (c) {
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
	 * 
	 * This includes auto-generated *.unyt.app domains
	 */
	public get domains() {
		if (!this.#domains) {
			// custom host domains
			const domains = globalThis.Deno?.env.get("UIX_HOST_DOMAINS")?.split(",") ?? [];

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

	public async start(options:appOptions = {}, originalBaseURL?:string|URL) {
		const { startApp } = await import("./start-app.ts");
		const {nOptions, baseURL, defaultServer} = await startApp(options, originalBaseURL)
		this.options = nOptions;
		this.defaultServer = defaultServer;
		this.base_url = baseURL;

		this.#ready = true;
		for (const handler of this.#ready_handlers) await handler();	
	}


	async reset(resetEndpoint = false) {
		if (resetEndpoint) endpoint_config.clear();
        localStorage.clear();

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

// @ts-ignore
globalThis.reset = app.reset

bindingOptions.mapFileURL = (url) => {
	return convertToWebPath(url);
}