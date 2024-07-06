/**
 * This script starts a UIX app
 */

import { Datex, datex } from "datex-core-legacy/no_init.ts"; // required by getAppConfig
import type { Datex as _Datex } from "datex-core-legacy"; // required by getAppConfig
import { getAppOptions } from "./src/app/config-files.ts";
import { getExistingFile } from "./src/utils/file-utils.ts";
import { command_line_options, enableTLS, login, init, rootPath, stage, watch, watch_backend, live } from "./src/app/args.ts";
import { normalizeAppOptions, normalizedAppOptions } from "./src/app/options.ts";
import { runLocal } from "./src/runners/run-local.ts";
import { runRemote } from "./src/runners/run-remote.ts";
import GitDeployPlugin from "./src/plugins/git-deploy.ts";
import LocalDockerRunner from "./src/runners/run-local-docker.ts";
import { triggerLogin } from "./src/utils/login.ts";
import { initBaseProject } from "./src/utils/init-base-project.ts";
import { CommandLineOptions } from "datex-core-legacy/utils/command-line-args/main.ts";
import { createProxyImports } from "./src/app/module-mapping.ts";
import { getDXConfigData } from "./src/app/dx-config-parser.ts";
import { Path } from "./src/utils/path.ts";
import { handleAutoUpdate, updateCache } from "./auto-update.ts";

import { addUIXNamespace } from "./src/base/uix-datex-module.ts"

import { enableUnhandledRejectionHandler } from "./src/utils/handle-issue.ts";
import { enableErrorReporting } from "datex-core-legacy/utils/error-reporting.ts";
import { getErrorReportingPreference, saveErrorReportingPreference, shouldAskForErrorReportingPreference } from "./src/utils/error-reporting-preference.ts";
import { isCIRunner } from "./src/utils/check-ci.ts";
import { logger, runParams } from "./src/runners/runner.ts";
import { applyPlugins } from "./src/app/config-files.ts";
import { handleError } from "./src/utils/handle-issue.ts";

// catch unhandledrejections
enableUnhandledRejectionHandler(logger);

// login flow
if (login) await triggerLogin();
// init
if (init != undefined) {
	if (rootPath) {
		handleError("A UIX Project exists already in this location", logger);
	}
	else await initBaseProject(init);
}

// allow unyt.org diagnostics?
if (stage === "dev") {
	try {
		let allow = false;
		
		if (await shouldAskForErrorReportingPreference()) {
			allow = confirm("\nWould you like to share anonymized error reports with unyt.org to help improve UIX?");
			await saveErrorReportingPreference(allow);
		}
		else {
			await getErrorReportingPreference();
		}
		
		enableErrorReporting(allow);
	}
	catch {
		// ignore
	}
}



// version update?
let forceUpdate = false;
const updatePromises = []
if (await handleAutoUpdate(new Path(import.meta.url).parent_dir, "UIX")) {
	updatePromises.push(
		updateCache(import.meta.resolve("./run.ts")),
		updateCache(import.meta.resolve("./src/app/start.ts")),
		updateCache("https://cdn.unyt.org/uix/run.ts")
	)
	forceUpdate = true
}
if (await handleAutoUpdate(new Path(import.meta.resolve("datex-core-legacy")).parent_dir, "DATEX Core")) {
	updatePromises.push(updateCache(import.meta.resolve("datex-core-legacy/datex.ts")))
	forceUpdate = true
}

await Promise.all(updatePromises)

Datex.Logger.development_log_level = Datex.LOG_LEVEL.WARNING
Datex.Logger.production_log_level = Datex.LOG_LEVEL.WARNING



const isWatching = live || watch_backend;

const params: runParams = {
	reload: forceUpdate || command_line_options.option("reload", {type:"boolean", aliases:["r"], description: "Force reload deno caches"}),
	enableTLS: enableTLS,
	inspect: command_line_options.option("inspect", {type:"string", description: "Enable debugging for the deno process"}),
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

await addUIXNamespace();

// find importmap (from app.dx or deno.json) to start the actual deno process with valid imports
const plugins = await loadPlugins();
const runners = [new LocalDockerRunner()];
const [options, new_base_url] = await normalizeAppOptions(await getAppOptions(rootPath), rootPath);
if (!options.import_map) throw new Error("Could not find importmap");
options.import_map = await createProxyImports(options, new_base_url, params.deno_config_path!);

await applyPlugins(plugins, rootPath, options)

await runBackends(options);


async function runBackends(options: normalizedAppOptions) {

	// no backends defined, can just run local
	if (!options.backend.length) {
		runLocal(params, new_base_url, options, isWatching);
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
				runLocal(params, new_base_url, options, isWatching)
			}
		}
		catch (e) {
			console.log(e)
		}
		
	}
}
