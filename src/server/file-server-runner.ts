import { Path } from "datex-core-legacy/utils/path.ts";
import { Server } from "./server.ts";
import { TypescriptImportResolver } from "./ts-import-resolver.ts";
import { Transpiler } from "./transpiler.ts";

import { CommandLineOptions } from "datex-core-legacy/utils/command-line-args/main.ts"
export const options = new CommandLineOptions("UIX File Server", "Simple static file server with integrated typescript support");


const watch = options.option("watch", {aliases: ["w"], default: false, type: "boolean", description: "Re-compile TypeScript files on change"});
const port =  options.option("port", {default: 80, type: "number", description: "The port on which the web server should run"});
const path =  options.option("path", {aliases: ["p"], default: Deno.cwd(), type: "string", description: "The file directory", collectNotPrefixedArgs: true, allowEmptyString: false});

const lib_dir = new Path<Path.Protocol.File>(path, "file://"+Deno.cwd()+"/").asDir();
let import_map_path = lib_dir.getChildPath('deno.json')
// check if deno json has external import map
const denoJsonExternalImportMap = import_map_path.fs_exists && JSON.parse(await import_map_path.getTextContent())?.importMap;
if (denoJsonExternalImportMap) import_map_path = new Path<Path.Protocol.File>(denoJsonExternalImportMap, import_map_path);

if (!import_map_path.fs_exists) import_map_path = lib_dir.getChildPath('importmap.dev.json')
if (!import_map_path.fs_exists) import_map_path = lib_dir.getChildPath('importmap.json')
if (!import_map_path.fs_exists) import_map_path = new Path<Path.Protocol.File>(Deno.cwd()).asDir().getChildPath('importmap.dev.json')
if (!import_map_path.fs_exists) import_map_path = new Path<Path.Protocol.File>(Deno.cwd()).asDir().getChildPath('importmap.json')
// if (!import_map_path.fs_exists) throw "Could not find an import map";
const importmap = import_map_path.fs_exists ? await import_map_path.getTextContent() : await new Path("https://dev.cdn.unyt.org/importmap.json").getTextContent()

new Server(lib_dir, {
    cors: true, 
    resolve_index_html: true,
    transpilers: {
        '/': new Transpiler(lib_dir, {
            watch: watch,
            import_resolver: new TypescriptImportResolver(lib_dir, {
				import_map: {imports: JSON.parse(importmap).imports}
            })
        })
    }
}).listen(port);