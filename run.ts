/**
 * This script starts a UIX app
 */

import { Datex, datex } from "unyt_core/no_init.ts"; // required by getAppConfig
import type { Datex as _Datex } from "unyt_core"; // required by getAppConfig

import { getAppOptions } from "./app/config-files.ts";
import { getExistingFile } from "./utils/file_utils.ts";
import { command_line_options, login, rootPath, stage } from "./app/args.ts";
import { normalizeAppOptions, normalizedAppOptions } from "./app/options.ts";
import { runLocal } from "./runners/run-local.ts";
import { runRemote } from "./runners/run-remote.ts";
import GitDeployPlugin from "./plugins/git-deploy.ts";
import LocalDockerRunner from "./runners/run-local-docker.ts";

import { triggerLogin } from "./utils/login.ts";
import { CommandLineOptions } from "https://dev.cdn.unyt.org/command-line-args/main.ts";
import { getDXConfigData } from "./app/dx-config-parser.ts";
import type { runParams } from "./runners/runner.ts";

const logger = new Datex.Logger("UIX Runner");

// login flow
if (login) await triggerLogin();

Datex.Logger.development_log_level = Datex.LOG_LEVEL.WARNING
Datex.Logger.production_log_level = Datex.LOG_LEVEL.WARNING;


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


const params: runParams = {
	reload: command_line_options.option("reload", {type:"boolean", aliases:["r"], description: "Force reload deno caches"}),
	enableTLS: command_line_options.option("enable-tls", {type:"boolean", description: "Run the web server with TLS"}),
	inspect: command_line_options.option("inspect", {type:"boolean", description: "Enable debugging for the deno process"}),
	unstable: command_line_options.option("unstable", {type:"boolean", description: "Enable unstable deno features"}),
	detach: command_line_options.option("detach", {type:"boolean", aliases: ["d"], default: false, description: "Keep the app running in background"}),

	deno_config_path: getExistingFile(rootPath, './deno.json')
}

// forced command line args capture, exit after this point
if (CommandLineOptions.collecting) await CommandLineOptions.capture()


async function loadPlugins() {
	const plugins = [new GitDeployPlugin()];

	const pluginDx = getExistingFile(rootPath, './plugins.dx');
	if (pluginDx) {
		let pluginData = await datex.get<Iterable<string|URL>>(pluginDx);
		if (pluginData instanceof URL || typeof pluginData == "string") pluginData = [pluginData];
		if (pluginData instanceof Datex.Tuple) pluginData = pluginData.toArray();
	
		for (const pluginUrl of pluginData??[]) {
			const pluginClass = (await import(pluginUrl.toString())).default;
			const plugin = new pluginClass();
			logger.debug(`Loaded plugin "${plugin.name}" (${pluginUrl})`);
	
			// name collision, override existing plugin
			const existingPlugin = plugins.find(p => p.name === plugin.name);
			if (existingPlugin) {
				plugins.splice(plugins.indexOf(existingPlugin), 1);
				logger.warn(`Plugin "${plugin.name}" was overridden with ${pluginUrl}`)
			}
			
			plugins.push(plugin);
		}
	}
	return plugins;
}

async function mockUIX() {
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
}

await mockUIX();
// find importmap (from app.dx or deno.json) to start the actual deno process with valid imports
const plugins = await loadPlugins();
const runners = [new LocalDockerRunner()];
const [options, new_base_url] = await normalizeAppOptions(await getAppOptions(rootPath, plugins), rootPath);

// make sure UIX mock is not overridden
await mockUIX();

await runBackends(options);


async function runBackends(options: normalizedAppOptions) {

	// no backends defined, can just run local
	if (!options.backend.length) {
		runLocal(params, new_base_url, options);
		return;
	}

	for (const backend of options.backend) {		
		try {
			const {requiredLocation, stageEndpoint, domains, volumes} = await getDXConfigData(backend, options);

			if (requiredLocation && requiredLocation !== Datex.LOCAL_ENDPOINT && requiredLocation?.toString() !== Deno.env.get("UIX_HOST_ENDPOINT")) {
				// custom runner
				if (typeof requiredLocation == "string") {
					let found = false;
					for (const runner of runners) {
						if (runner.name == requiredLocation) {
							await runner.run({
								params,
								baseURL: new_base_url,
								options,
								backend,
								endpoint: stageEndpoint,
								domains,
								volumes
							})
							found = true;
						}
					}
					if (!found) {
						logger.error(`UIX app runner for location "${requiredLocation}" not found`);
						Deno.exit(1);
					}
				}
				// run on a remote host (docker host)
				if (requiredLocation instanceof Datex.Endpoint ) {
					runRemote(params, new_base_url, options, backend, requiredLocation, stageEndpoint, domains, volumes);
				}
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