import { Path } from "../utils/path.ts";
import { Server } from "./server.ts";
import { TypescriptImportResolver } from "./ts_import_resolver.ts";
import { TypescriptTranspiler } from "./ts_transpiler.ts";

import { CommandLineOptions } from "unyt/command-line-args/main.ts"
export const options = new CommandLineOptions("UIX File Server", "Simple static file server with integrated typescript support");


const watch = options.option("watch", {aliases: ["w"], default: false, type: "boolean", description: "Re-compile TypeScript files on change"});
const port =  options.option("port", {default: 80, type: "number", description: "The port on which the web server should run"});
const path =  options.option("path", {aliases: ["p"], default: Deno.cwd(), type: "string", description: "The file directory", collectNotPrefixedArgs: true, allowEmptyString: false});

const lib_dir = new Path(path, "file://"+Deno.cwd()+"/").asDir();
let import_map_path = lib_dir.getChildPath('importmap.dev.json')
if (!import_map_path.fs_exists) import_map_path = lib_dir.getChildPath('importmap.json')
if (!import_map_path.fs_exists) import_map_path = new Path(Deno.cwd()).asDir().getChildPath('importmap.dev.json')
if (!import_map_path.fs_exists) import_map_path = new Path(Deno.cwd()).asDir().getChildPath('importmap.json')
if (!import_map_path.fs_exists) throw "Could not find an import map";

new Server(lib_dir, {
    cors: true, 
    resolve_index_html: true,
    transpilers: {
        '/': new TypescriptTranspiler(lib_dir, {
            watch: watch,
            import_resolver: new TypescriptImportResolver(lib_dir, {
				import_map: JSON.parse(await import_map_path.getTextContent())
            })
        })
    }
}).listen(port);