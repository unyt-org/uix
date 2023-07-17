import type { normalized_app_options } from "./app/options.ts";
import { getExistingFile } from "./utils/file_utils.ts";
import type {runParams} from "./run.ts";

export async function runLocal(params: runParams, root_path: URL, options: normalized_app_options) {

	// const importmap_path = <string> (<any> options.import_map_path)?.toString();
	// const import_map = importmap_path ? JSON.parse(importmap_path.startsWith("http") ? await (await fetch(importmap_path)).text() : Deno.readTextFileSync(<string>options.import_map_path)) : options.import_map;
	// const run_script_abs_url = import_map.imports?.['uix/'] + run_script_url;

	const run_script_url = "app/run.ts"
	const run_script_abs_url = options.import_map.imports['uix/'] + run_script_url;

	// reload cache
	if (params.reload) {
		const deno_lock_path = getExistingFile(root_path, './deno.lock');
		if (deno_lock_path) {
			console.log("removing " + new URL(deno_lock_path).pathname);
			await Deno.remove(deno_lock_path)
		}
	}

	// start actual deno process

	const config_params:string[] = [];

	const cmd = [
		"deno",
		"run",
		"-Aq"
	];

	if (params.enableTLS) cmd.push("--unsafely-ignore-certificate-errors=localhost");

	if (params.reload) {
		cmd.push("--reload");
	}

	if (params.inspect) {
		cmd.push("--inspect");
	}

	if (params.unstable) {
		cmd.push("--unstable");
	}

	if (params.deno_config_path) {
		config_params.push("--config", params.deno_config_path instanceof URL && params.deno_config_path.protocol=="file:" ? params.deno_config_path.pathname : params.deno_config_path.toString())
	}
	if (options.import_map.path) {
		config_params.push("--import-map", options.import_map.path?.is_web ? options.import_map.path.toString() : options.import_map.path?.normal_pathname)
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
}