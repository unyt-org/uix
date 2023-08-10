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

const CI_INDICATOR_VARS = [
	'CI',
	'GITLAB_CI',
	'GITHUB_ACTIONS'
]

function isCIRunner() {
	for (const ciVar of CI_INDICATOR_VARS) {
		if (Deno.env.has(ciVar)) return true;
	}
	return false;
}

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

async function getDXConfigData(path: URL) {
	const dx = await datex.get(path) as Record<string,any>;
	const requiredLocation: DatexType.Endpoint = Datex.Value.collapseValue(Datex.DatexObject.get(dx, 'location'), true, true) ?? Datex.LOCAL_ENDPOINT;
	const stageEndpoint: DatexType.Endpoint = Datex.Value.collapseValue(Datex.DatexObject.get(dx, 'endpoint'), true, true) ?? Datex.LOCAL_ENDPOINT;
	const port: number = Datex.Value.collapseValue(Datex.DatexObject.get(dx, 'port'), true, true);

	let domains:string[] = Datex.Value.collapseValue(Datex.DatexObject.get(dx, 'domain'), true, true);
	// make sure customDomains is a string array
	if (domains instanceof Datex.Tuple) domains = domains.toArray();
	else if (typeof domains == "string") domains = [domains];
	else if (domains === Datex.LOCAL_ENDPOINT) domains = [];
	domains = domains?.filter(d=>d!==Datex.LOCAL_ENDPOINT) ?? [];

	return {
		port,
		requiredLocation,
		stageEndpoint,
		domains
	}
}

async function runBackends(options: normalized_app_options) {

	// no backends defined, can just run local
	if (!options.backend.length) {
		runLocal(params, new_base_url, options);
		return;
	}

	for (const backend of options.backend) {
		const backendDxFile = backend.getChildPath(".dx");
		
		try {
			let requiredLocation: DatexType.Endpoint|undefined;
			let stageEndpoint: DatexType.Endpoint|undefined;
			const domains:Record<string, number|null> = {}; // domain name -> internal port
			if (backendDxFile.fs_exists) {
				let backendDomains: string[]|undefined;
				({requiredLocation, stageEndpoint, domains: backendDomains} = await getDXConfigData(backendDxFile))
				for (const domain of backendDomains) {
					domains[domain] = null; // no port mapping specified per default
				}
			}

			let autoPort = 80;
			for (const frontend of options.frontend) {
				const frontendDxFile = frontend.getChildPath(".dx");
				if (frontendDxFile.fs_exists) {
					const {domains: frontendDomains, port} = await getDXConfigData(frontendDxFile);

					if (frontendDomains) {
						const domainPort = port ?? autoPort++;
						for (const domain of frontendDomains) {
							domains[domain] = domainPort; // no port mapping specified per default
						}
					}
				}
			}

			// console.log(domains)

			// run on a remote host
			if (requiredLocation && requiredLocation !== Datex.LOCAL_ENDPOINT && requiredLocation?.toString() !== Deno.env.get("UIX_HOST_ENDPOINT")) {
				runRemote(params, new_base_url, options, backend, requiredLocation, stageEndpoint, domains);
			}
			// run locally
			else {
				// local run in CI not allowed
				if (isCIRunner()) {
					const example = `
 ===================================
 use stage from # public.uix;

 location: stage {
     ${stage}: @+unyt_eu1
 }
 ===================================
`;
					(new Datex.Logger()).error("Cannot run the UIX app directly on the CI Runner.\n Make sure your .dx configuration is correct.\n The 'location' option for the '"+stage+"' stage must be a host endpoint, but is currently unset (defaults to local)\n Example .dx configuration: \n" + example)
					Deno.exit(1);
				}
				runLocal(params, new_base_url, options)
			}
		}
		catch (e) {
			console.log(e)
		}
		
	}
}