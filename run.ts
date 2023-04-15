/**
 * This script starts a UIX app.
 * 
 * Default project structure:
 * 	- backend/  (optional)
 * 	  - entrypoint.ts
 *  - common/   (optional)
 *    - ....
 *  - frontend/ (optional)
 *    - entrypoint.ts
 *  - app.dx
 */

import { Datex } from "https://dev.cdn.unyt.org/unyt_core/no_init.ts"; // required by getAppConfig
import { getAppConfig } from "./utils/config_files.ts";
import { getExistingFile } from "./utils/file_utils.ts";
import { command_line_options, root_path } from "./utils/args.ts";

const reload = command_line_options.option("reload", {type:"boolean", aliases:["r"]})
const deno_config_path = getExistingFile(root_path, './deno.json');

Datex.Logger.development_log_level = Datex.LOG_LEVEL.ERROR
Datex.Logger.production_log_level = Datex.LOG_LEVEL.ERROR
const run_script_url = "app/run.ts";

// find importmap (from app.dx or deno.json) to start the actual deno process with valid imports
const config = await getAppConfig(root_path);

const importmap_path = <string> (<any> config.import_map_path)?.toString();
const import_map = importmap_path ? JSON.parse(importmap_path.startsWith("http") ? await (await fetch(importmap_path)).text() : Deno.readTextFileSync(<string>config.import_map_path)) : config.import_map;
const run_script_abs_url = import_map.imports?.['uix/'] + run_script_url;


// reload cache
if (reload) {
	const deno_lock_path = getExistingFile(root_path, './deno.lock');
	if (deno_lock_path) {
		console.log("removing " + deno_lock_path);
		await Deno.remove(deno_lock_path)
	}
}

// start actual deno process

const config_params:string[] = [];

const cmd = [
	"deno",
	"run",
	"-Aq",
];

if (reload) {
	cmd.push("--reload");
}

if (deno_config_path) {
	config_params.push("--config", deno_config_path instanceof URL && deno_config_path.protocol=="file:" ? deno_config_path.pathname : deno_config_path.toString())
}
if (config.import_map_path) {
	config_params.push("--import-map", config.import_map_path instanceof URL && config.import_map_path.protocol=="file:" ? config.import_map_path.pathname : config.import_map_path.toString())
}

await run();

async function run() {

	const exitStatus = await Deno.run({
		cmd: [
			...cmd,
			...config_params,
			run_script_abs_url,
			...config_params, // pass --import-map and --config also as runtime args to reconstruct the command when the backend restarts
			  ...Deno.args,
		]
	}).status();
	if (exitStatus.code == 42) {
		console.log(".....");
		await run();
	}
}

