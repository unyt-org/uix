import { CommandLineOptions } from "https://dev.cdn.unyt.org/command-line-args/main.ts"
import { Path } from "../utils/path.ts";
import { getExistingFile } from "../utils/file-utils.ts";
import { UIX } from "../uix.ts";

export const command_line_options = new CommandLineOptions("UIX", "Fullstack Web Framework with DATEX Integration.\nVisit https://unyt.org/uix for more information", "../RUN.md");

const path = command_line_options.option("path", {aliases:["p"], collectNotPrefixedArgs: true, type:"string", description: "The root path for the UIX app (parent directory for app.dx and deno.json)"});
const _path = new Path(path??'./', 'file://' + Deno.cwd() + '/');

// look for app.dx parent dir to find a valid root path
const config_path = getExistingFile(_path, './app.dx', './app.json', './src/app.dx', './src/app.json');

export const watch_backend = command_line_options.option("watch-backend", {aliases:["b"], type:"boolean", default: false, description: "Restart the backend deno process when backend files are modified"});
export const live_frontend = command_line_options.option("live", {aliases:["l"],  type:"boolean", default: false, description: "Automatically reload connected browsers tabs when files are modified"});
export const watch = command_line_options.option("watch", {aliases:["w"],  type:"boolean", default: false, description: "Recompile frontend scripts when files are modified"}) || live_frontend;
export const http_over_datex = command_line_options.option("http-over-datex", {aliases:["hod"], type:"boolean", default: true, description: "Enable HTTP-over-DATEX"});

export const stage = command_line_options.option("stage", {type:"string", default: "dev", description: "Current deployment stage"})!;
export const env = command_line_options.option("env", {type:"string", multiple: true, description: "Exposed environment variables (for remote deployment)"});

export const login = command_line_options.option("login", {type:"boolean", description: "Show login dialog"});

export const version = command_line_options.option("version", {type:"boolean", description: "Get the version of your UIX installation"});

if (version) {
	console.log(`UIX ${UIX.version == "beta" ? "beta" : "v." + UIX.version} (${new URL("../", import.meta.url)})`);
	Deno.exit(0);
}

if (!config_path && !CommandLineOptions.collecting) {
	throw "Could not find an app.dx or app.json config file in " + _path.pathname
}
export const root_path = (config_path ? new Path(config_path).parent_dir : null) as Path.File;

// const login = command_line_options.command("login", {

// });

// if (login) {
// 	console.log("LOGIN")
// 	Deno.exit(0);
// }