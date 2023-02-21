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

import "https://cdn.unyt.org/unyt_core/no_init.ts"; // required by getAppConfig

Datex.Logger.development_log_level = Datex.LOG_LEVEL.ERROR
Datex.Logger.production_log_level = Datex.LOG_LEVEL.ERROR

import { getAppConfig } from "./utils/config_files.ts";
import { getExistingFile } from "./utils/file_utils.ts";

const default_importmap = "https://cdn.unyt.org/importmap.json";
const run_script_url = "app/run.ts";

const flags = (await import("https://deno.land/std@0.168.0/flags/mod.ts")).parse(Deno.args, {
	string: ["path"],
	boolean: ["reload"],
	alias: {
		p: "path",
		r: "reload"
	}
});
const root_path = new URL(flags["path"]??'./', 'file://' + Deno.cwd() + '/');
const deno_config_path = getExistingFile(root_path, './deno.json');

// find importmap (from app.dx or deno.json) to start the actual deno process with valid imports
const config = await getAppConfig(root_path);
if (!config.import_map && !config.import_map_path) config.import_map_path = default_importmap;
if (config.import_map) throw "embeded import maps are not yet supported for uix apps";

// todo: fix
if (!config.import_map_path) throw '"import_map_path" in app.dx or "importMap" in deno.json required'
console.log("using import map: " + config.import_map_path);

const importmap_path = <string> (<any> config.import_map_path)?.toString();

const import_map = importmap_path ? JSON.parse(importmap_path.startsWith("http") ? await (await fetch(importmap_path)).text() : Deno.readTextFileSync(<string>config.import_map_path)) : config.import_map;

const run_script_abs_url = import_map.imports?.['uix/'] + run_script_url;


// reload cache
if (flags.reload) {
	const deno_lock_path = getExistingFile(root_path, './deno.lock');
	if (deno_lock_path) {
		console.log("removing deno.lock");
		await Deno.remove(deno_lock_path)
	}
}

// start actual deno process

const cmd = [
	"deno",
	"run",
	"-A",
	"-q",
	"--no-check"
];

if (flags.reload) {
	cmd.push("--reload");
}

if (deno_config_path) {
	cmd.push("--config", deno_config_path instanceof URL ? deno_config_path.pathname : deno_config_path)
}
if (config.import_map_path) {
	cmd.push("--import-map", config.import_map_path instanceof URL ? config.import_map_path.pathname : <string> config.import_map_path)
}

await Deno.run({
	cmd: [
		...cmd,
		run_script_abs_url,
	  	...Deno.args,
	]
}).status();