import { CommandLineOptions } from "datex-core-legacy/utils/command-line-args/main.ts"
import { Path } from "datex-core-legacy/utils/path.ts";
import { getExistingFile } from "../utils/file-utils.ts";
import { ESCAPE_SEQUENCES } from "datex-core-legacy/utils/logger.ts";
import { isDenoForUIX, version as UIX_VERSION } from "../utils/version.ts";
import { _updateProjectRootURL } from "datex-core-legacy/utils/global_values.ts"
import { handleError, KnownError } from "datex-core-legacy/utils/error-handling.ts";

export const command_line_options = new CommandLineOptions("UIX", "Fullstack Web Framework with DATEX Integration.\nVisit https://unyt.org/uix for more information", "../RUN.md");

export let path = command_line_options.option("path", {collectNotPrefixedArgs: true, type:"string", description: "The root path for the UIX app (parent directory for app.dx and deno.json)"});
let _path: Path.File;
updatePath(path);

export function updatePath(newPath?: string) {
	path = newPath;
	_path = new Path(path??'./', 'file://' + Deno.cwd() + '/');
}

export const watch_backend = command_line_options.option("watch-backend", {aliases:["b"], type:"boolean", default: false, description: "Restart the backend deno process when backend files are modified"});
export const live = command_line_options.option("live", {aliases:["l"],  type:"boolean", default: false, description: "Automatically reload connected browsers tabs when files are modified and enable automatic backend restarts"});
export const watch = command_line_options.option("watch", {aliases:["w"],  type:"boolean", default: false, description: "Recompile frontend scripts when files are modified"}) || live;
export const http_over_datex = command_line_options.option("http-over-datex", {aliases:["hod"], type:"boolean", default: true, description: "Enable HTTP-over-DATEX"});
export const enable_datex_cli = command_line_options.option("datex-cli", {type:"boolean", default: false, description: "Enable DATEX CLI"});

export const stage = command_line_options.option("stage", {type:"string", default: "dev", description: "Current deployment stage"})!;
export const env = command_line_options.option("env", {type:"string", multiple: true, description: "Exposed environment variables (for remote deployment)"});

export const allowAll = command_line_options.option("allow-all", {type:"boolean", default: false, aliases:["y"], description: "Autmatically confirm all dialogs"});
export const allowNone = command_line_options.option("allow-none", {type:"boolean", default: false, aliases:["n"], description: "Automatically decline all dialog"});

export const login = command_line_options.option("login", {type:"boolean", description: "Show login dialog"});
export const init = command_line_options.option("init", {type:"string", description: "Inititialize a new UIX project"});
export const template = command_line_options.option("template", {allowEmptyString: true, type:"string", description: "Pass a template to the UIX init call to create your project from"});

// TODO: aliases:["p"],  -p xxxx not working
export const port = command_line_options.option("port", {default: 80, type:"number", description: "The port for the HTTP server"});

export const enableTLS = command_line_options.option("enable-tls", {type:"boolean", description: "Enable TLS for the HTTP server"});

export const gitToken = command_line_options.option("git-token", {type:"string", description: "GitHub/GitLab token for running in remote location"});
export const hostToken = command_line_options.option("host-token", {type:"string", description: "Docker Host access token for running in remote location"});

// clear
export const clear = command_line_options.option("clear", {type:"boolean", description: "Clear all eternal states on the backend"});

// persistent transpile cache path
export const transpileCachePathRaw = command_line_options.option("transpile-cache-path", {type:"string", description: "Path to store transpiled file persistently"});
export const transpileCachePath = transpileCachePathRaw ? new URL(transpileCachePathRaw, "file://" + Deno.cwd() + "/") : undefined;

export const reload = command_line_options.option("reload", {type:"boolean", aliases: ["r"], default: false, description: "Reload dependency caches"});

// print uix version
const version = command_line_options.option("version", {type:"boolean", description: "Get the version of your UIX installation"});

if (version) {
	const DATEX_VERSION = (await import("datex-core-legacy/VERSION.ts")).default;

	let log = `${ESCAPE_SEQUENCES.BOLD}${ESCAPE_SEQUENCES.UNYT_BLUE}UIX ${UIX_VERSION == "beta" ? "beta" : UIX_VERSION}${ESCAPE_SEQUENCES.RESET} (${new URL("../../", import.meta.url)})`;
	log += `\n\n${ESCAPE_SEQUENCES.BOLD}DATEX Core: ${ESCAPE_SEQUENCES.RESET} ${DATEX_VERSION == "beta" ? "beta" : DATEX_VERSION} (${import.meta.resolve("datex-core-legacy/")})`
	log +=   `\n${ESCAPE_SEQUENCES.BOLD}Deno:       ${ESCAPE_SEQUENCES.RESET} ${Deno.version.deno}` + (isDenoForUIX() ? " (Deno for UIX)" : '')
	log +=   `\n${ESCAPE_SEQUENCES.BOLD}TypeScript: ${ESCAPE_SEQUENCES.RESET} ${Deno.version.typescript}`
	log +=   `\n${ESCAPE_SEQUENCES.BOLD}V8:         ${ESCAPE_SEQUENCES.RESET} ${Deno.version.v8}`

	console.log(log);
	Deno.exit(0);
}



export let rootPath:Path.File;	
await updateRootPath(CommandLineOptions.collecting||init!=null);

export async function updateRootPath(allowFail = false) {
	const config_path = getExistingFile(_path, './app.dx', './app.json', './src/app.dx', './src/app.json');

	if (!config_path && !allowFail) {
		handleError(
			new KnownError(
				`The directory does not appear to be a UIX project.\n(No app.dx or app.json file was found in ${_path.normal_pathname})`,
				[
					"Initialize a new project by running 'uix --init'",
					"Change directory to a project that contains an 'app.dx' or 'src/app.dx' file",
					"Change directory to a project that contains an 'app.json' or 'src/app.json' file",
					"Create an 'app.dx' file with the project fields 'name' and 'description'"
				]
			)
		);
	}

	rootPath = (config_path ? new Path(config_path).parent_dir : null) as Path.File;
	if (rootPath) await _updateProjectRootURL(rootPath);
}