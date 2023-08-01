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

import { Datex, datex } from "unyt_core/no_init.ts"; // required by getAppConfig
import type {Datex as DatexType} from "unyt_core";

import { getAppOptions } from "./utils/config_files.ts";
import { getExistingFile } from "./utils/file_utils.ts";
import { command_line_options, login, root_path, stage } from "./utils/args.ts";
import { normalizeAppOptions, normalized_app_options } from "./app/options.ts";
import { runLocal } from "./run-local.ts";
import { runRemote } from "./run-remote.ts";
import { GitDeployPlugin } from "./plugins/git-deploy.ts";
import { triggerLogin } from "./utils/login.ts";

// login flow
if (login) await triggerLogin();

Datex.Logger.development_log_level = Datex.LOG_LEVEL.ERROR
Datex.Logger.production_log_level = Datex.LOG_LEVEL.ERROR



/**
 * command line params + files
 */
export type runParams = {
    reload: boolean | undefined;
    enableTLS: boolean | undefined;
    inspect: boolean | undefined;
    unstable: boolean | undefined;
	detach: boolean | undefined;
    deno_config_path: string | URL | null;
}

const params: runParams = {
	reload: command_line_options.option("reload", {type:"boolean", aliases:["r"]}),
	enableTLS: command_line_options.option("enable-tls", {type:"boolean"}),
	inspect: command_line_options.option("inspect", {type:"boolean"}),
	unstable: command_line_options.option("unstable", {type:"boolean"}),
	detach: command_line_options.option("detach", {type:"boolean", aliases: ["d"], default: false}),

	deno_config_path: getExistingFile(root_path, './deno.json')
}

/**
 * Mock #public.uix
 */
await datex`
	#public.uix = {
		stage: function (options) (
			options.${stage} default @@local
		)
	}
`

// find importmap (from app.dx or deno.json) to start the actual deno process with valid imports
const [options, new_base_url] = await normalizeAppOptions(await getAppOptions(root_path, [new GitDeployPlugin()]), root_path);
await runBackends(options);

async function runBackends(options: normalized_app_options) {

	// no backends defined, can just run local
	if (!options.backend.length) {
		runLocal(params, new_base_url, options);
		return;
	}

	for (const backend of options.backend) {
		const dxFile = backend.getChildPath(".dx");
		
		try {
			let requiredLocation: DatexType.Endpoint|undefined;
			let stageEndpoint: DatexType.Endpoint|undefined;
			let customDomain: string|undefined;
			if (dxFile.fs_exists) {
				const dx = await datex.get(dxFile) as Record<string,any>;
				requiredLocation = Datex.Value.collapseValue(Datex.DatexObject.get(dx, 'location'), true, true) ?? Datex.LOCAL_ENDPOINT;
				stageEndpoint = Datex.Value.collapseValue(Datex.DatexObject.get(dx, 'endpoint'), true, true) ?? Datex.LOCAL_ENDPOINT;
				customDomain = Datex.Value.collapseValue(Datex.DatexObject.get(dx, 'domain'), true, true);
				if (customDomain === Datex.LOCAL_ENDPOINT) customDomain = undefined;
			}
			// run on a remote host
			if (requiredLocation && requiredLocation !== Datex.LOCAL_ENDPOINT && requiredLocation?.toString() !== Deno.env.get("UIX_HOST_ENDPOINT")) {
				runRemote(params, new_base_url, options, backend, requiredLocation, stageEndpoint, customDomain);
			}
			// run locally
			else {
				runLocal(params, new_base_url, options)
			}
		}
		catch (e) {
			console.log(e)
		}
		
	}
}