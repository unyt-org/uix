import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";
import { clear, live, rootPath, watch, watch_backend } from "../app/args.ts";
import type { normalizedAppOptions } from "../app/options.ts";
import { getExistingFile } from "../utils/file-utils.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { logger, runParams } from "./runner.ts";
import { verboseArg } from "datex-core-legacy/utils/logger.ts";
import { generateReactiveIndices } from "./reactive-index-generation.ts";
import { CTRLSEQ, CSI, printReloadingStatus } from "../utils/logging.ts";


export async function runLocal(params: runParams, root_path: URL, options: normalizedAppOptions, isWatching: boolean) {

	// TODO: is this still required? Does not work with docker restart clear
	// if (clear) {
	// 	try {
	// 		await Deno.remove(ptr_cache_path, {recursive :true})
	// 		await Deno.mkdir(ptr_cache_path, {recursive: true})
	// 		logger.warn("Cleared all eternal states on the backend")
	// 	}
	// 	catch (e) {
	// 		console.error(e)
	// 	}
	// }
	
	const run_script_url = "app/start.ts"
	const run_script_import_map_entry = options.import_map.imports['uix/'] + run_script_url;
	const run_script_abs_url = 
		(run_script_import_map_entry.startsWith("https://") || run_script_import_map_entry.startsWith("http://")) ?
		run_script_import_map_entry :
		new Path(run_script_import_map_entry, options.import_map.path??options.import_map_path).toString();

	// reload cache
	if (params.reload) {
		const deno_lock_path = getExistingFile(root_path, './deno.lock');
		if (deno_lock_path) {
			// console.log("removing " + new URL(deno_lock_path).pathname);
			await Deno.remove(deno_lock_path)
		}
	}

	// start actual deno process

	const config_params:string[] = [];

	const cmd = [
		"run",
		"-Aq",
		"--unstable-ffi", // required for sqlite3
		//"--check",
	];

	const args = [...Deno.args];

	if (params.enableTLS) cmd.push("--unsafely-ignore-certificate-errors=localhost");

	if (params.reload) {
		cmd.push("--reload");
	}

	if (params.inspect!=undefined) {
		if (params.inspect) cmd.push(`--inspect=${params.inspect}`);
		else cmd.push("--inspect");
	}

	if (params.unstable) {
		cmd.push("--unstable");
	}

	if (params.deno_config_path) {
		config_params.push("--config", params.deno_config_path instanceof URL && params.deno_config_path.protocol=="file:" ? new Path(params.deno_config_path).normal_pathname : params.deno_config_path.toString())
	}
	if (options.import_map.path) {
		config_params.push("--import-map", options.import_map.path?.is_web ? options.import_map.path.toString() : options.import_map.path?.normal_pathname)
	}

	// pass different path (required when starting for the first time with uix --init)
	if (rootPath.normal_pathname != new Path('file://' + Deno.cwd() + '/').normal_pathname) {
		args.push("--path", rootPath.normal_pathname)
	}

	let process: Deno.ChildProcess | undefined;

	// explicitly kill child process to trigger SIG event on child process
	// (required for saving state on exit)
	addEventListener("unload", ()=>{
		// show cursor again
		console.log(CSI + "?25h");
		if (process) {
			try {
				process.kill();
				process = undefined;
			}
			catch {/* ignore */}
		}
		else {
			logger.error("Cannot kill child process")
		}
	}, {capture: true});

	Deno.addSignalListener("SIGINT", ()=>Deno.exit())


	try {
		// not supported by WiNdoWs
		Deno.addSignalListener("SIGTERM", ()=>Deno.exit())
		Deno.addSignalListener("SIGQUIT", ()=>Deno.exit())
	}
	catch {
		/* ignore */
	}

	// hide cursor
	console.log(CSI + "?25l");
	
	// handle clear state when live reloading
	let isClearingState = clear;
	let stateCleared = false;

	let tscWatching = watch || watch_backend || live;
	let updateReactiveIndices = await generateReactiveIndices(options, tscWatching);

	// Enable raw mode to capture key events
	const createCtrlPromise = listenForKeyShortcuts();
	await run();

	async function reRun() {
		process = undefined;
		// init watch based TSC if not yet watching
		if (!tscWatching) {
			tscWatching = true;
			// wait for reactive index update before restarting
			updateReactiveIndices = await generateReactiveIndices(options, tscWatching, false);
		}
		else {
			// wait until reactive index update, or continue after timeout (assuming a non-tsx file was updated and triggered the restart)
			await updateReactiveIndices();
		}
		await run(true);
	}
	
	async function run(restart = false) {
		if (!verboseArg) {
			await Deno.stdout.write(new TextEncoder().encode(CTRLSEQ.FULL_CLEAR));
			await Deno.stdout.write(new TextEncoder().encode(CTRLSEQ.HOME));
		}

		if (restart) {
			printReloadingStatus("Relauching \"" + options.name + "\"...");
		}
		else {
			printReloadingStatus("Launching \"" + options.name + "\"...");
		}

		if (stateCleared) {
			stateCleared = false;
			logger.warn("Cleared all eternal states on the backend");
		}

		// handle clear state when deployed in docker
		// prevent clearing again when the docker container restarts
		if (args.includes("--clear")) {
			// not inside cache dir, because this should not be persisted over on recreation
			const clearIndicatorPath = new Path("../.uix-state-cleared", cache_path); 
			if (clearIndicatorPath.fs_exists) {
				console.log("State was already cleared, skipping --clear")
				args.splice(args.indexOf("--clear"), 1);
				isClearingState = true;
			}
			// only set clear indicator when running in deployed environment
			else if (Deno.env.has("UIX_HOST_ENDPOINT")) {
				Deno.mkdirSync(cache_path, {recursive: true});
				Deno.writeTextFileSync(clearIndicatorPath.normal_pathname, "");
			}
		}

		const command = new Deno.Command(Deno.execPath(), {
			args: [
				...cmd,
				...config_params,
				run_script_abs_url,
				...config_params, // pass --import-map and --config also as runtime args to reconstruct the command when the backend restarts
				...args,
			],
			env: {
				SQLITE_STORAGE: options.experimental_features.includes("sqlite-storage") ? "1" : "0",
				UIX_METADATA_DIR: new Path("./uix/jusix/metadata", cache_path).normal_pathname,
			}
		})

		process = command.spawn();

		// detach, continues in background
		// TODO: fix child process does not keep running correctly
		if (params.detach) {
			console.log(`UIX App running in background (PID ${process.pid})`);
			Deno.exit(0);
		}
		  
		// Start listening to Ctrl+R and Ctrl+C in the background
		const exitStatus = await Promise.race([
			createCtrlPromise(),
			process.output()
		]);

		// CTRL+R
		if (exitStatus.code == 420) {
			console.log("CTRL+R pressed, restarting backend...");
			try {
				process.kill()
			}
			catch {
				// ignore
			}
			await reRun();
		}
		// Restart triggered from child process
		else if (exitStatus.code == 42) {
			await reRun();
		}
		else if (isClearingState) {
			stateCleared = true;
			isClearingState = false;
			// restart without --clear
			args.splice(args.indexOf("--clear"), 1);
			await reRun();
		}
		else if (isWatching) {
			console.log("waiting until files are updated...");
			// error - wait until a file was modified before restart
			try {
				for await (const _event of Deno.watchFs(new Path(root_path).normal_pathname, {recursive: true})) {
					break;
				}
			}
			catch (e) {
				if (e.message?.includes("os error 38")) logger.warn("Watching for file changes is not supported");
				else throw e;
			}
			await reRun();
		}

		Deno.exit(exitStatus.code);
	}
}


function listenForKeyShortcuts() {
	const decoder = new TextDecoder();
	Deno.stdin.setRaw(true); 

	const resolvers = new Set<((value: {code: number}) => void)>();

	const createCtrlPromise = () => new Promise<{code: number}>((resolve) => {
		resolvers.add(resolve);
	});

	(async () => {
		for await (const chunk of Deno.stdin.readable) {
			const key = decoder.decode(chunk);
			// Ctrl+R (ASCII 18)
			if (key === "\x12") { 
				for (const resolve of resolvers) {
					resolve({code: 420});
				};
				resolvers.clear();
			}
			// CTRL+C - exit
			else if (key === "\x03") {
				console.log("CTRL+C pressed, exiting...");
				Deno.exit();
			}
		}
	})();

	return createCtrlPromise;
}