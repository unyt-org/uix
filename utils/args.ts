import { CommandLineOptions } from "https://dev.cdn.unyt.org/command-line-args/main.ts"
export const command_line_options = new CommandLineOptions("UIX", "Fullstack Web Framework with DATEX Integration");

const path = command_line_options.option("path", {aliases:["p"], type:"string", description: "The root path for the UIX app (parent directory for app.dx and deno.json)"});
export const root_path = new URL(path??'./', 'file://' + Deno.cwd() + '/');

export const watch_backend = command_line_options.option("watch-backend", {aliases:["b"], type:"boolean", default: false, description: "Restart the backend deno process when backend files are modified"});
export const live_frontend = command_line_options.option("live", {aliases:["l"],  type:"boolean", default: false, description: "Automatically reload connected browsers tabs when files are modified (also enables --watch)"});
export const watch = command_line_options.option("watch", {aliases:["w"],  type:"boolean", default: false, description: "Recompile frontend scripts when files are modified"}) || live_frontend;
export const http_via_datex = command_line_options.option("http-via-datex", {aliases:["hvd"], type:"boolean", default: true, description: "Enable HTTP-via-DATEX"});
