import { Datex } from "unyt_core";

import { FrontendManager } from "./frontend_manager.ts";
import { BackendManager } from "./backend_manager.ts";
import { endpoint_config } from "unyt_core/runtime/endpoint_config.ts";
import { getLocalFileTextContent } from "unyt_core/datex_all.ts";

const logger = new Datex.Logger("UIX App");

let live_frontend = false;

// command line args (--watch-backend)
if (globalThis.Deno) {
    const parse = (await import("https://deno.land/std@0.168.0/flags/mod.ts")).parse;
    const flags = parse(Deno.args, {
        boolean: ["live"],
        alias: {
            l: "live"
        }
    });
    live_frontend = flags["live"]
}




export type app_options = {
	name?: string,  // app name
	description?: string, // app description
	icon_path?: string, // path to app icon / favicon
	version?: string, // app version
	stage?: string, // stage (production, dev, ...)
	installable?: boolean, // can be installed as standalone web app
	offline_support?: boolean, // add a service worker with offline cache
	
	frontend?: string|URL|(string|URL)[], // directory for frontend code
	backend?:  string|URL|(string|URL)[] // directory for backend code
	common?: string|URL|(string|URL)[] // directory with access from both frotend end backend code

	//entrypoint?: string|URL|(()=>UIX.Components.Base|UIX.UIXAppInstance|Promise<UIX.Components.Base|UIX.UIXAppInstance>), // script to be executed when loading the app on the frontend, uses ./entrypoint.ts per default, or component provider
	import_map_path?: string|URL, // custom importmap for the frontend
	import_map?: {imports:Record<string,string>} // prefer over import map path
}

export interface normalized_app_options extends app_options {
	frontend: URL[]
	backend: URL[]
	common: URL[],

	scripts: (URL|string)[],
	import_map_path: never
}

class UIXApp {

	#base_url!: URL

	public async start(options:app_options = {}, base_url?:string|URL) {

		const n_options = <normalized_app_options> {};
		
		// determine base url
		if (typeof base_url == "string" && !base_url.startsWith("file://")) base_url = 'file://' + base_url;
		base_url ??= new Error().stack?.trim()?.match(/((?:https?|file)\:\/\/.*?)(?::\d+)*(?:$|\nevaluate@)/)?.[1];
		if (!base_url) throw new Error("Could not determine the app base url (this should not happen)");
		this.#base_url = new URL(base_url.toString());

		n_options.name = options.name;
		n_options.description = options.description;
		n_options.icon_path = options.icon_path;
		n_options.version = options.version;
		n_options.stage = options.stage;
		n_options.offline_support = options.offline_support ?? true;
		n_options.installable = options.installable ?? false;
		
		// import map or import map path
		if (options.import_map) n_options.import_map = options.import_map;
		else if (options.import_map_path) n_options.import_map = JSON.parse(await getLocalFileTextContent(options.import_map_path))
		
		n_options.frontend = ((options.frontend instanceof Array ? options.frontend : [options.frontend]).filter(p=>!!p) as (string | URL)[]).map(p=>new URL(p,base_url));
		n_options.backend = ((options.backend instanceof Array ? options.backend : [options.backend]).filter(p=>!!p) as (string | URL)[]).map(p=>new URL(p,base_url));
		n_options.common = ((options.common instanceof Array ? options.common : [options.common]).filter(p=>!!p) as (string | URL)[]).map(p=>new URL(p,base_url));

		if (!n_options.frontend.length) {
			// try to find the frontend dir
			const frontend_dir = new URL("./frontend/",base_url);
			try {
				if (!Deno.statSync(frontend_dir).isFile) n_options.frontend.push(frontend_dir)
			}
			catch {}
		}

		if (!n_options.backend.length) {
			// try to find the backend dir
			const backend_dir = new URL("./backend/",base_url);
			try {
				if (!Deno.statSync(backend_dir).isFile) n_options.backend.push(backend_dir)
			}
			catch {}
		}

		if (!n_options.common.length) {
			// try to find the common dir
			const common_dir = new URL("./common/",base_url);
			try {
				if (!Deno.statSync(common_dir).isFile) n_options.common.push(common_dir)
			}
			catch {}
		}

		// logger.info("options", n_options)

		// for unyt log
		Datex.Unyt.setApp(n_options.name!, n_options.version!, n_options.stage!)

		// set .dx path to backend
		if (n_options.backend.length) {
			await endpoint_config.load(new URL("./.dx", n_options.backend[0]))
		}

		// connect to supranet
		await Datex.Supranet.connect();

		// load backend
		for (const backend of n_options.backend) {
			new BackendManager(n_options, backend, this.#base_url).run();
		}

		// load frontend
		for (const frontend of n_options.frontend) {
			new FrontendManager(n_options, frontend, this.#base_url, live_frontend).run();
		}
	}



	// private addClientScript(file:string|URL){
	// 	if (typeof file == "string") {
	// 		if (this.#frontend_root_url) this.#client_scripts.push(new URL(file, this.#frontend_root_url));
	// 		else this.#js_relative_file_paths.add(file);
	// 	}
	// 	else this.#client_scripts.push(file);
	// }


	// // TODO: rename to setFrontendEntrypoint
	// private setClientEntrypoint(path:string|URL){
	// 	if (typeof path == "string") {
	// 		if (this.#frontend_root_url) this.#client_entry_point = new URL(path, this.#frontend_root_url);
	// 		else this.#relative_client_entry_point = path
	// 	}
	// 	else this.#client_entry_point = path;
	// }
	
	// // TODO: rename to setFrontendDir
	// private setFrontendRootDir(path:URL|string){
	// 	this.#frontend_root_url = path.toString();
	// 	this.#frontend_root_path = this.#frontend_root_url.replace("file://","").replace(/\/$/,"");
	// 	for (const f of this.#js_relative_file_paths) {
	// 		this.#client_scripts.push(new URL(f, this.#frontend_root_url));
	// 		this.#js_relative_file_paths.delete(f)
	// 	}

	// 	if (this.#relative_client_entry_point) {
	// 		this.#client_entry_point = new URL(this.#relative_client_entry_point, this.#frontend_root_url);
	// 		this.#relative_client_entry_point = undefined;
	// 	}

	// 	// default to entrypoint.ts
	// 	if (!this.#client_entry_point) {
	// 		this.setClientEntrypoint("./entrypoint.ts");
	// 	}
	// }

	// private setBackendDir(path:URL|string) {
	// 	this.#backend_root_url = path.toString();
	// 	this.#backend_root_path = path.toString().replace("file://","").replace(/\/$/,"");
	// }

	// private setCommonDir(path:URL|string) {
	// 	this.#common_root_url = path.toString();
	// 	this.#common_root_path = path.toString().replace("file://","").replace(/\/$/,"");
	// }
}

export function getDirType(app_options:normalized_app_options, path:string) {
	if (!path.startsWith("file://")) path =  path.replace("file://","")
	
	// backend path?
	for (const backend of app_options.backend) {
		if (path.startsWith(backend.pathname)) return 'backend'
	}

	// frontend path?
	for (const frontend of app_options.frontend) {
		if (path.startsWith(frontend.pathname)) return 'frontend'
	}

	// common path?
	for (const common of app_options.common) {
		if (path.startsWith(common.pathname)) return 'common'
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