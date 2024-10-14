// no explicit imports, should also work without import maps...
import {getExistingFile} from "../utils/file-utils.ts";
import { command_line_options } from "../app/args.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { Datex } from "datex-core-legacy/mod.ts";
import type { AppPlugin } from "./app-plugin.ts";
import { logger } from "../utils/global-values.ts";
import { normalizedAppOptions } from "./options.ts";
import { handleError, KnownError } from "datex-core-legacy/utils/error-handling.ts";

const default_importmap = "https://dev.cdn.unyt.org/importmap.json";
const arg_import_map_string = command_line_options.option("import-map", {type:"string", description: "Import map path"});
const arg_import_map = (arg_import_map_string?.startsWith("http://")||arg_import_map_string?.startsWith("https://")) ?
	new URL(arg_import_map_string) :
	(arg_import_map_string ? 
		new URL("file://" + arg_import_map_string) :
		undefined
	)

export async function applyPlugins(plugins: AppPlugin[], rootPath: Path, appOptions: normalizedAppOptions) {
	const config_path = getExistingFile(rootPath, './app.dx', './app.json');

	if (!config_path) {
		handleError(
			new KnownError(
				`The directory does not appear to be a UIX project.\n(No app.dx or app.json file was found in ${new Path(rootPath).normal_pathname}.)`,
				[
					"Initialize a new project by running 'uix --init'",
					"Change directory to a project that contains an 'app.dx' file",
					"Change directory to a project that contains an 'app.json' file",
					"Create an 'app.dx' file with the project fields 'name' and 'description'"
				]
			)
		);
	}

	// handle plugins (only if in dev environment, not on host, TODO: better solution)
	if (plugins?.length && !Deno.env.get("UIX_HOST_ENDPOINT")) {
		const pluginData = await datex.get<Record<string,any>>(config_path, undefined, undefined, plugins.map(p=>p.name));
		for (const plugin of plugins) {
			if (pluginData[plugin.name]) {
				logger.debug(`using plugin "${plugin.name}"`);
				await plugin.apply(pluginData[plugin.name], rootPath, appOptions)
			}
		}
	}
}

/**
 * get combined config of app.dx and deno.json and command line args
 */
export async function getAppOptions(rootPath:URL) {
	const config_path = getExistingFile(rootPath, './app.dx', './app.json');
	let config:Record<string,unknown> = {}
	
	if (config_path) {

		const raw_config = await Datex.Runtime.getURLContent(config_path);
		if (typeof raw_config != "object" || !raw_config) {
			throw "Invalid config file"
		}
		config = Object.fromEntries(Datex.DatexObject.entries(<Record<string, unknown>>raw_config));
	}
	else {
		handleError(
			new KnownError(
				`The directory does not appear to be a UIX project.\n(No app.dx or app.json file was found in ${new Path(rootPath).normal_pathname})`,
				[
					"Initialize a new project by running 'uix --init'",
					"Change directory to a project that contains an 'app.dx' file",
					"Change directory to a project that contains an 'app.json' file",
					"Create an 'app.dx' file with the project fields 'name' and 'description'"
				]
			)
		);
	}

	// overwrite --import-map path
	if (arg_import_map) config.import_map_path = arg_import_map;

	// set import map from deno.json if exists
	const deno_path = getExistingFile(rootPath, './deno.json', './deno.jsonc');

	if (deno_path) {

		try {
			const deno = JSON.parse(await Deno.readTextFile(new Path(deno_path).normal_pathname));

			// jusix
			if (deno.compilerOptions?.jsxImportSource == "jusix") {
				config.jusix = true;
			}

			if (!config.import_map_path && !config.import_map) {			
				// error if using experimental decorators
				if (deno.compilerOptions?.experimentalDecorators) {
					logger.error("UIX uses ECMAScript Decorators, but you have the legacy experimental decorators enabled. Please remove the 'experimentalDecorators' option from your deno.json config.");
					Deno.exit(1)
				}
	
				// imports
				if (deno.imports) {
					//config.import_map = {imports:deno.imports};
					config.import_map_path = new URL(deno_path);
				}
				// _publicImportMap path
				else if (deno._publicImportMap) {
					config.import_map_path = new URL(deno._publicImportMap, rootPath);
				}
				// importMap path
				else if (deno.importMap) {
					config.import_map_path = new URL(deno.importMap, rootPath);
				}
			} 
		} catch {}
	}
	

	if (!config.import_map && !config.import_map_path) config.import_map_path = default_importmap;
	// if (config.import_map) throw "embeded import maps are not yet supported for uix apps";

	// todo: fix
	if (!config.import_map_path) throw '"import_map_path" in app.dx or "importMap"/"imports" in deno.json required';
	
	return config
}