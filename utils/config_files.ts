// no explicit imports, should also work without import maps...
import {getExistingFile} from "./file_utils.ts";
import { command_line_options } from "./args.ts";

const default_importmap = "https://cdn.unyt.org/importmap.json";
const arg_import_map = command_line_options.option("import-map", {type:"URL", description: "Import map path"});

/**
 * get combined config of app.dx and deno.json and command line args
 */
export async function getAppConfig(root_path:URL) {
	const config_path = getExistingFile(root_path, './app.dx', './app.json');
	let config:Record<string,unknown> = {}
	
	if (config_path) {
		const raw_config = await datex.get(config_path);
		if (typeof raw_config != "object" || !raw_config) {
			throw "Invalid config file"
		}
		config = Object.fromEntries(Datex.DatexObject.entries(<Record<string, unknown>>raw_config));
	}
	// else throw "Could not find an app.dx or app.json config file in the root directory " + root_path

	// set import map from deno.json if exists
	const deno_path = getExistingFile(root_path, './deno.json');
	if (!config.import_map_path && !config.import_map && deno_path) {
		try {
			const deno = JSON.parse(await Deno.readTextFile(deno_path));
			
			// imports
			if (deno.imports) {
				config.import_map = {imports:deno.imports};
			}
			// importMap path
			else if (deno.importMap) {
				config.import_map_path = new URL(deno.importMap, root_path);
			}
		} catch {}
	} 

	// overwrite --import-map path
	if (arg_import_map) config.import_map_path = arg_import_map;

	if (!config.import_map && !config.import_map_path) config.import_map_path = default_importmap;
	if (config.import_map) throw "embeded import maps are not yet supported for uix apps";

	// todo: fix
	if (!config.import_map_path) throw '"import_map_path" in app.dx or "importMap" in deno.json required';
	
	return config
}