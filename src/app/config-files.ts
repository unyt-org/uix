// no explicit imports, should also work without import maps...
import {getExistingFile} from "../utils/file-utils.ts";
import { command_line_options } from "../app/args.ts";
import { Path } from "../utils/path.ts";
import { Datex } from "datex-core-legacy/mod.ts";
import type { AppPlugin } from "./app-plugin.ts";

const default_importmap = "https://dev.cdn.unyt.org/importmap.json";
const arg_import_map = command_line_options.option("import-map", {type:"URL", description: "Import map path"});


/**
 * get combined config of app.dx and deno.json and command line args
 */
export async function getAppOptions(root_path:URL, plugins?: AppPlugin[]) {
	const config_path = getExistingFile(root_path, './app.dx', './app.json');
	let config:Record<string,unknown> = {}
	
	if (config_path) {

		const raw_config = await datex.get(config_path);
		if (typeof raw_config != "object" || !raw_config) {
			throw "Invalid config file"
		}
		config = Object.fromEntries(Datex.DatexObject.entries(<Record<string, unknown>>raw_config));

		// handle plugins (only if in dev environment, not on host, TODO: better solution)
		if (plugins?.length && !Deno.env.has("UIX_HOST_ENDPOINT")) {
			const pluginData = await datex.get<Record<string,any>>(config_path, undefined, undefined, plugins.map(p=>p.name));
			for (const plugin of plugins) {
				if (pluginData[plugin.name]) {
					console.log(`Using plugin "${plugin.name}"`);
					await plugin.apply(pluginData[plugin.name])
				}
			}
		}

	}
	else throw "Could not find an app.dx or app.json config file in " + new Path(root_path).normal_pathname


	// overwrite --import-map path
	if (arg_import_map) config.import_map_path = arg_import_map;

	// set import map from deno.json if exists
	const deno_path = getExistingFile(root_path, './deno.json', './deno.jsonc');
	if (!config.import_map_path && !config.import_map && deno_path) {
		try {
			const deno = JSON.parse(await Deno.readTextFile(new Path(deno_path).normal_pathname));
			
			// imports
			if (deno.imports) {
				//config.import_map = {imports:deno.imports};
				config.import_map_path = new URL(deno_path);
			}
			// _publicImportMap path
			else if (deno._publicImportMap) {
				config.import_map_path = new URL(deno._publicImportMap, root_path);
			}
			// importMap path
			else if (deno.importMap) {
				config.import_map_path = new URL(deno.importMap, root_path);
			}
		} catch {}
	} 


	if (!config.import_map && !config.import_map_path) config.import_map_path = default_importmap;
	// if (config.import_map) throw "embeded import maps are not yet supported for uix apps";

	// todo: fix
	if (!config.import_map_path) throw '"import_map_path" in app.dx or "importMap"/"imports" in deno.json required';
	
	return config
}