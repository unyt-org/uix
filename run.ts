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

import { getAppOptions } from "./utils/config_files.ts";
import { getExistingFile } from "./utils/file_utils.ts";
import { command_line_options, root_path, stage } from "./utils/args.ts";
import { normalizeAppOptions, normalized_app_options } from "./app/options.ts";
import { runLocal } from "./run-local.ts";
import { runRemote } from "./run-remote.ts";
import { GitDeployPlugin } from "./plugins/git-deploy.ts";

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
    deno_config_path: string | URL | null;
}

const params: runParams = {
	reload: command_line_options.option("reload", {type:"boolean", aliases:["r"]}),
	enableTLS: command_line_options.option("enable-tls", {type:"boolean"}),
	inspect: command_line_options.option("inspect", {type:"boolean"}),
	unstable: command_line_options.option("unstable", {type:"boolean"}),

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

	for (const backend of options.backend) {
		const dxFile = backend.getChildPath(".dx");
		if (dxFile.fs_exists) {
			try {
				const dx = await datex.get(dxFile);
				const requiredLocation = Datex.Value.collapseValue(Datex.DatexObject.get(dx, 'location'), true, true) ?? Datex.LOCAL_ENDPOINT;
				const stageEndpoint = Datex.Value.collapseValue(Datex.DatexObject.get(dx, 'endpoint'), true, true) ?? Datex.LOCAL_ENDPOINT;
				let customDomain = Datex.Value.collapseValue(Datex.DatexObject.get(dx, 'domain'), true, true);
				if (customDomain === Datex.LOCAL_ENDPOINT) customDomain = undefined;

				// run on a remote host
				if (requiredLocation !== Datex.LOCAL_ENDPOINT && requiredLocation.toString() !== Deno.env.get("UIX_HOST_ENDPOINT")) {
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
}