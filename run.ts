/**
 * This script starts a UIX app
 */

import { Datex, datex } from "datex-core-legacy/no_init.ts"; // required by getAppConfig
import type { Datex as _Datex } from "datex-core-legacy"; // required by getAppConfig

import { getAppOptions } from "./src/app/config-files.ts";
import { getExistingFile } from "./src/utils/file-utils.ts";
import { clear, command_line_options, enableTLS, login, init, rootPath, stage } from "./src/app/args.ts";
import { normalizeAppOptions, normalizedAppOptions } from "./src/app/options.ts";
import { runLocal } from "./src/runners/run-local.ts";
import { runRemote } from "./src/runners/run-remote.ts";
import GitDeployPlugin from "./src/plugins/git-deploy.ts";
import LocalDockerRunner from "./src/runners/run-local-docker.ts";
import { triggerLogin } from "./src/utils/login.ts";
import { initBaseProject } from "./src/utils/init-base-project.ts";
import { CommandLineOptions } from "https://dev.cdn.unyt.org/command-line-args/main.ts";
import { createProxyImports } from "./src/app/module-mapping.ts";
import { ptr_cache_path } from "datex-core-legacy/runtime/cache_path.ts";
import { getDXConfigData } from "./src/app/dx-config-parser.ts";

const logger = new Datex.Logger("UIX Runner");

// login flow
if (login) await triggerLogin();
// init
if (init) {
	if (rootPath) {
		logger.error("A UIX Project already exists in this location");
		Deno.exit(1);
	}
	else await initBaseProject();
}



if (clear) {
	try {
		await Deno.remove(ptr_cache_path, {recursive :true})
		await Deno.mkdir(ptr_cache_path, {recursive: true})
		logger.warn("Cleared eternal states on backend")
	}
	catch (e) {
		console.error(e)
	}
}

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
    deno_config_path: URL | null;
}

const params: runParams = {
	reload: command_line_options.option("reload", {type:"boolean", aliases:["r"], description: "Force reload deno caches"}),
	enableTLS: enableTLS,
	inspect: command_line_options.option("inspect", {type:"boolean", description: "Enable debugging for the deno process"}),
	unstable: command_line_options.option("unstable", {type:"boolean", description: "Enable unstable deno features"}),
	detach: command_line_options.option("detach", {type:"boolean", aliases: ["d"], default: false, description: "Keep the app running in background"}),

	deno_config_path: getExistingFile(rootPath, './deno.json', './deno.jsonc')
}

// forced command line args capture, exit after this point
if (CommandLineOptions.collecting) await CommandLineOptions.capture()


/**
 * Initialize plugins defined in plugins.dx + default UIX plugins
 */
async function loadPlugins() {
	const plugins = [new GitDeployPlugin()];

	const pluginDx = getExistingFile(rootPath, './plugins.dx');
	if (pluginDx) {
		let pluginData = await datex.get<Iterable<string|URL>>(pluginDx);
		if (pluginData instanceof URL || typeof pluginData == "string") pluginData = [pluginData];
		if (pluginData instanceof Datex.Tuple) pluginData = pluginData.toArray();
	
		for (const pluginUrl of pluginData??[]) {
			let pluginClass: any;
			try {
				pluginClass = (await import(pluginUrl.toString())).default;
			}
			catch {
				logger.error(`Could not load plugin from ${pluginUrl}`);
				continue;
			}
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

/**
 * Mock #public.uix
 */
async function mockUIX() {

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
if (!options.import_map) throw new Error("Could not find importmap");

options.import_map = await createProxyImports(options, new_base_url, params.deno_config_path!);

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
			const {requiredLocation, stageEndpoint, domains, volumes, instances} = await getDXConfigData(backend, options);

			// TODO better comparison between UIX_HOST_ENDPOINT (with possible instance) and requiredLocation
			const isRemote = requiredLocation && requiredLocation !== Datex.LOCAL_ENDPOINT && !Deno.env.get("UIX_HOST_ENDPOINT")?.startsWith(requiredLocation?.toString());

			// TODO: handle multiple instances

			if (isRemote) {
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
							break;
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