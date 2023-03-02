import { Datex } from "unyt_core";

import { FrontendManager } from "./frontend_manager.ts";
import { BackendManager } from "./backend_manager.ts";
import { endpoint_config } from "unyt_core/runtime/endpoint_config.ts";
import { getLocalFileContent } from "unyt_core/datex_all.ts";
import { Path } from "unyt_node/path.ts";
import { VERSION } from "../utils/constants.ts";

const logger = new Datex.Logger("UIX App");

let live_frontend = false;
let watch = false;

// command line args (--watch-backend)
if (globalThis.Deno) {
    const parse = (await import("https://deno.land/std@0.168.0/flags/mod.ts")).parse;
    const flags = parse(Deno.args, {
        boolean: ["live", "watch"],
        alias: {
            l: "live",
			w: "watch"
        },
		default: {watch, live:live_frontend}
    });
    live_frontend = flags["live"]
	watch = live_frontend || flags["watch"]
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
	icon_path: string,

	scripts: (URL|string)[],
	import_map_path: never
	import_map: {imports:Record<string,string>}
}

class UIXApp {

	public async start(options:app_options = {}, base_url?:string|URL) {

		const n_options = <normalized_app_options> {};
		
		// determine base url
		if (typeof base_url == "string" && !base_url.startsWith("file://")) base_url = 'file://' + base_url;
		base_url ??= new Error().stack?.trim()?.match(/((?:https?|file)\:\/\/.*?)(?::\d+)*(?:$|\nevaluate@)/)?.[1];
		if (!base_url) throw new Error("Could not determine the app base url (this should not happen)");
		base_url = new URL(base_url.toString());

		n_options.name = options.name;
		n_options.description = options.description;
		n_options.icon_path = options.icon_path ?? 'https://cdn.unyt.org/unyt_core/assets/skeleton_light.svg'
		n_options.version = options.version?.replaceAll("\n","");
		n_options.stage = options.stage?.replaceAll("\n","");
		n_options.offline_support = options.offline_support ?? true;
		n_options.installable = options.installable ?? false;
		
		// import map or import map path
		if (options.import_map) n_options.import_map = options.import_map;
		else if (options.import_map_path) n_options.import_map = JSON.parse(<string>await getLocalFileContent(options.import_map_path))
		
		if (options.frontend instanceof Datex.Tuple) options.frontend = options.frontend.toArray();
		if (options.backend instanceof Datex.Tuple) options.backend = options.backend.toArray();
		if (options.common instanceof Datex.Tuple) options.common = options.common.toArray();

		n_options.frontend = options.frontend instanceof Array ? options.frontend.filter(p=>!!p).map(p=>new URL(p,base_url)) : (new Path(options.frontend??'./frontend/', base_url).fs_exists ? [new Path(options.frontend??'./frontend/', base_url)] : []);
		n_options.backend  = options.backend instanceof Array  ? options.backend.filter(p=>!!p).map(p=>new URL(p,base_url)) :  (new Path(options.backend??'./backend/', base_url).fs_exists ? [new Path(options.backend??'./backend/', base_url)] : []);
		n_options.common   = options.common instanceof Array   ? options.common.filter(p=>!!p).map(p=>new URL(p,base_url)) :   (new Path(options.common??'./common/', base_url).fs_exists ? [new Path(options.common??'./common/', base_url)] : []);


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
			console.log("setting endpoint config for backend: " + new URL("./.dx", n_options.backend[0]));
			await endpoint_config.load(new URL("./.dx", n_options.backend[0]))
		}

		// connect to supranet
		await Datex.Supranet.connect();

		// load backend
		for (const backend of n_options.backend) {
			new BackendManager(n_options, backend, base_url).run();
		}

		// load frontend
		for (const frontend of n_options.frontend) {
			await new FrontendManager(n_options, frontend, base_url, watch, live_frontend).run();
		}
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