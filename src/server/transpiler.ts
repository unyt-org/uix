import { Path } from "../utils/path.ts"; 
import { Datex } from "datex-core-legacy";
import { TypescriptImportResolver } from "./ts-import-resolver.ts";
import { getCallerDir } from "datex-core-legacy/utils/caller_metadata.ts";
import { eternalExts, updateEternalFile } from "../app/module-mapping.ts";
import { app } from "../app/app.ts";
import { sendReport } from "datex-core-legacy/utils/error-reporting.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";

const copy = client_type === "deno" ? (await import("https://deno.land/std@0.160.0/fs/copy.ts")) : null;
const walk = client_type === "deno" ? (await import("https://deno.land/std@0.177.0/fs/mod.ts")).walk : null;
const {transpile} = client_type === "deno" ? (await import("https://deno.land/x/ts_transpiler@v0.0.1/mod.ts")) : {transpile:null};
const sass = client_type === "deno" ? (await import("https://deno.land/x/denosass@1.0.6/mod.ts")).default : null;



const logger = new Datex.Logger("transpiler");

/**
 * Directory structure:
 * 
 *  transpiler_cache_xy/
 *      frontend.transpiled.web
 *          file.ts
 *          file.js
 *          virtualfile.ts
 *          virtualfile.js
 */

export type transpiler_options = {
    watch?: boolean, // watch src dir and update on change, default: false
    copy_all?: boolean, // if true, all files are copied to a tmp directory, otherwise only the ones that have to be transpiled, default: false
    transpile_exts?: Record<string,string> // extensions of files to transpile, default: {ts:'js', mts:'mjs'}
    on_file_update?: file_update_handler,
    import_resolver?: TypescriptImportResolver,
    dist_parent_dir?: Path.File, // parent dir for dist dirs
    dist_dir?: Path.File, // use different path for dist (default: generated tmp dir)
    sourceMap?: boolean // generate inline source maps when transpiling ts
}

type transpiler_options_all = Required<transpiler_options>;

type file_update_handler = (file:Path.File)=>void

/**
 * Transpiler (for ts + scss)
 */
export class Transpiler {

    private TMP_DIR_PREFIX = "transpiler_cache_";
    private TRANSPILED_DIR_EXT = "transpiled.web";

    #options!: transpiler_options_all
    #transpile_exts!: string[]

	#src_dir:Path.File
	#dist_dir?:Path.File
    #tmp_dir?: Path.File

    #main_fs_watcher?: Deno.FsWatcher
    #fs_watchers = new Map<string, Deno.FsWatcher>();

    #file_update_listeners = new Set<file_update_handler>()

    #virtual_files = new Set<string>()

    #import_resolver?: TypescriptImportResolver
    get import_resolver() {return this.#import_resolver}

    get src_dir() {return this.#src_dir}

    // /tmp/compile_cache_xy/
    get tmp_dir(){
        if (this.#options.dist_parent_dir) return this.#options.dist_parent_dir;
        if (!this.#tmp_dir) this.#tmp_dir = Path.dir(Deno.makeTempDirSync({prefix: this.TMP_DIR_PREFIX}))
        return this.#tmp_dir;
    }

    // /tmp/compile_cache_xy/x.transpiled.web
    get dist_dir(){
        if (this.#options.dist_dir) return this.#options.dist_dir; // custom dist dir
        if (!this.#dist_dir) {
            this.#dist_dir = Path.dir(this.src_dir.name, this.tmp_dir).getWithFileExtension(this.TRANSPILED_DIR_EXT);
            this.#dist_dir.fsCreateIfNotExists();
        }
        return this.#dist_dir;
    }


    // returns true if the file has to be transpiled 
    isTranspiledFile(path:Path) {
        return path.hasFileExtension(...this.#transpile_exts) && !path.hasFileExtension('d.ts')
    }

    // returns true if the tranpiled file has the same name as the src file (e.g. x.css -> x.css)
    transpiledNameEqualsSourceName(path:Path) {
        return this.#options.transpile_exts[path.ext!] === path.ext
    }

    // returns true if the file was created as a virtual file (does not exist in the original source directory)
    isVirtualFile(path:Path) {
        return this.#virtual_files.has(path.toString());
    }

    // returns true if a copy of the file exists in the tmp directory
    isClonedFile(path:Path) {
        return this.#options.copy_all ? true : (this.isTranspiledFile(path) || this.isVirtualFile(path)); // always true if copy_all, otherwise check if transpiled or virtual file
    }

    /**
     * returns the file path with the mapped extension (e.g. x.ts -> x.js)
     */
    getFileWithMappedExtension(path:Path.File, replace_all=false) {
        const ext = this.#options.transpile_exts[path.ext!];
        return ext ? path.getWithFileExtension(ext,replace_all) : path;
    }
    
    /**
     * Get the dist path for a src file (e.g. the js file created from the src ts file or a virtual file)
     * @param src_path path of original source file
     * @param resolve_transpiled if true, return path for corresponding compiled js/css file
     */
    public getDistPath(src_path:Path.File, resolve_transpiled = true) {
        if (this.isClonedFile(src_path) || src_path.fs_is_dir) {
            let dist_path = src_path.getWithChangedParent(this.src_dir, this.dist_dir);
            if (resolve_transpiled && dist_path.hasFileExtension(...this.#transpile_exts)) {
                dist_path = this.getFileWithMappedExtension(dist_path);
            }
            return dist_path;
        }
        else return null; // no dist path, just use src path
    }

	constructor(src_dir:Path.File|string, options:transpiler_options = {}) {
        src_dir = src_dir instanceof Path ? src_dir : new Path(src_dir, getCallerDir());

        if (Datex.client_type !== "deno") throw new Error("tranpiler currently only supported in deno environments");

		this.#src_dir = src_dir;
        this.setOptions(options);
	}

    #initialized = false;

    public async init(){

        if (this.#initialized) return;
        this.#initialized = true;

        if (this.#options.copy_all) {
            await copy!.copy(this.src_dir, this.dist_dir);
        }

        await this.initDistDir()

        if (this.#options.watch) this.activateFileWatcher();
        addEventListener("unload", ()=>this.close())
        addEventListener("unhandledrejection", ()=>this.close())

        return this;
    }

    // clone required files from src to dist, transpile
    public async initDistDir() {
        // console.log("... cloning to dist dir: " + this.#src_dir.pathname);
        await this.transpileDir(this.src_dir)
    }

    /**
     * pre-transpile all files in directory (recursive)
     */
    public async transpileDir(dir: Path.File) {
        const promises = []
        for await (const e of walk!(dir, {includeDirs: false, exts: this.#transpile_exts.map(x=>'.'+x)})) {
            promises.push(this.updateFile(new Path(e.path), true, true));
        }
        await Promise.all(promises)
    }

    // stop, remove tmp dir
    public close() {
        this.stopFileWatcher()
        if (this.#tmp_dir) {
            logger.debug("removing cache directory: " + this.#tmp_dir);
            try {Deno.removeSync(this.#tmp_dir, {recursive:true})} catch {} 
        }
    }

    private setOptions(options:transpiler_options = {}) {
        if (!('transpile_exts' in options)) options.transpile_exts = {'ts':'js', 'mts':'js', 'tsx':'js', 'scss':'css'};
        if (!options.transpile_exts) options.transpile_exts = {};
        if (!('copy_all' in options)) options.copy_all = false;
        if (!('watch' in options)) options.watch = false;

        this.#options = <transpiler_options_all> options;
        this.#transpile_exts = Object.keys(this.#options.transpile_exts)
        if (this.#options.import_resolver) this.#import_resolver = this.#options.import_resolver;
        if (this.#options.on_file_update) this.onFileUpdate(this.#options.on_file_update);
    }

    resolveRelativeSrcPath(path:string|URL) {
        let resolved:Path.File;
        if (path instanceof Path) resolved = path;
        else if (path instanceof URL) resolved = new Path(path);
        else resolved = new Path(path, this.src_dir);
        if (!resolved.isChildOf(this.src_dir)) {
            logger.warn("path " + path + " is not inside the source directory");
            return null
        }
        return resolved;
    }


	private async activateFileWatcher(){
        if (!this.#src_dir) throw new Error("no src directory set");

        // logger.info("file watcher activated for " + this.src_dir.pathname);

        for await (const event of this.#main_fs_watcher = Deno.watchFs(this.src_dir.normal_pathname, {recursive: true})) {
            try {
				for (const path of event.paths) {
					this.handleFileWatchUpdate(path);
				}
            }
            catch (e) {
                console.log("file update error:",e);
            }
        }
    }

    // "debounce" multiple file updates
    private currentlyUpdating = new Set<string>()
    
    private handleFileWatchUpdate(path: string) {
        if (this.currentlyUpdating.has(path)) return;
        this.currentlyUpdating.add(path);

        setTimeout(async ()=>{
            const src_path = new Path<Path.Protocol.File>(path);

            logger.info("#color(grey)file update: " + src_path.getAsRelativeFrom(this.src_dir.parent_dir).replace(/^\.\//, ''));

            // is eternal file, update
            if (src_path.hasFileExtension(...eternalExts)) {
                await updateEternalFile(src_path, app.base_url, app.options!.import_map, app.options!);
            }
    
            // ignore file if using file from original src directory
            if (!this.#options.copy_all && !src_path.hasFileExtension(...this.#transpile_exts)) {
                for (const handler of this.#file_update_listeners) handler(src_path);
                return;
            } 
    
            // TODO: ignore directories for now
            if (await src_path.fsIsDir()) return;
    
            this.currentlyUpdating.delete(path);
            await this.updateFile(src_path);
        }, 50)
    }

    /**
     * add a handler that gets called every time when a file in the source directory changed
     * @param handler 
     */
    public onFileUpdate(handler: file_update_handler) {
        if (!this.#options.watch) throw new Error("cannot add file update listener - file watcher not enabled for transpiler")
        this.#file_update_listeners.add(handler)
    }

    private stopFileWatcher(){
        if (this.#main_fs_watcher) {
            try {this.#main_fs_watcher.close()} catch {}
        }
    }

    async updateFile(src_path:Path.File|string, _transpile_only_if_not_exists = false, silent_update = false) {
        const p = this.resolveRelativeSrcPath(src_path);
        if (!p) return;
        src_path = p;

        await this.updateFileToDist(src_path, this.dist_dir, _transpile_only_if_not_exists);
        if (!silent_update) {
            for (const handler of this.#file_update_listeners) handler(src_path);
        }
    }

    private async updateFileToDist(src_path:Path.File, dist_dir:Path.File, _transpile_only_if_not_exists = false) {
        if (!this.isClonedFile(src_path)) return; // ignore, no copy required
        if (await src_path.fsIsDir()) throw new Error("src path is directory")

        const dist_path = src_path.getWithChangedParent(this.src_dir, dist_dir);

        // update in dist
        if (await src_path.fsExists()) {
            dist_path.parent_dir.fsCreateIfNotExists();
            await Deno.copyFile(src_path, dist_path); 
            // transpile?
            const mapped_dist_path = this.getFileWithMappedExtension(dist_path);
            const transpileExtEqualsSrcExt = this.transpiledNameEqualsSourceName(src_path) // e.g. css -> scc, should always recompile, cannot rely on mapped_dist_path.fs_exists
            if (this.isTranspiledFile(dist_path) && (!_transpile_only_if_not_exists || !await mapped_dist_path.fsExists() || transpileExtEqualsSrcExt)) {
                await this.transpile(dist_path, src_path);
            }
        }
        // delete in dist if deleted
        else if (await dist_path.fsExists()) {
            await Deno.remove(dist_path)
        }
    }

    /**
     * entrypoint for transpiling files
     * @param dist_path path for the current file
     * @param src_path virtual src path
     */
    protected async transpile(dist_path:Path.File, src_path:Path.File){
        const mapped_dist_path = this.getFileWithMappedExtension(dist_path);

        // transpile ts to js
        if (mapped_dist_path.ext == "js") await this.transpileTS(dist_path, src_path)
        else if (mapped_dist_path.ext == "css") await this.transpileSCSS(dist_path, src_path)
    }

    protected async transpileTS(dist_path:Path.File, src_path:Path.File) {
        const js_dist_path = await this.transpileToJS(dist_path)
        if (this.import_resolver) {
            await this.import_resolver.resolveImports(dist_path, src_path, true); // resolve imports in ts, no side effects (don't update referenced module files)
            await this.import_resolver.resolveImports(js_dist_path, src_path)
        }
    }


    protected async transpileSCSS(path:Path.File, src_path:Path.File) {
        await this.loadSCSSDependencies(src_path);
        try {
            // remove /C: for winDoWs
            const compiler = sass!([path.pathname.replace(/^\/\w:/,"")], {})
            const css = (compiler.to_string("expanded") as Map<string,string>).get(path.name.split(".")[0]);
            if (css==null) {
                logger.error("could not transpile scss: " + path.normal_pathname);
                return;
            }
            await Deno.writeTextFile(this.getFileWithMappedExtension(path).normal_pathname, css);
            // TODO:
            // await this.transpileScopedCss(path, src_path)
        }
        catch (e) {
            sendReport("uix-0002", {
                path,
                normal_pathname: path.normal_pathname,
                formatted_pathname: path.pathname.replace(/^\/\w:/,""),
                content: await path.getTextContent()
            })
            if (e.message?.endsWith("memory access out of bounds")) logger.error("SCSS error ("+src_path.normal_pathname+"): memory access out of bounds (possible circular imports)");
            else logger.error("SCSS error ("+src_path.normal_pathname+"): " + e)
        }
    }

    #loadedSCSSFiles = new Set<string>()

    protected async loadSCSSDependencies(src_path:Path.File) {
        const srcPathString = src_path.toString();
        if (this.#loadedSCSSFiles.has(srcPathString)) return; // already loading / loaded
        this.#loadedSCSSFiles.add(srcPathString);

        const content = await Deno.readTextFile(src_path.normal_pathname);
        for (const dep of content.matchAll(/^\s*@use\s*"([^"]*)"/gm)) {
            let import_path = new Path<Path.Protocol.File>(dep[1], src_path);
            if (!import_path.ext) import_path = import_path.getWithFileExtension("scss");
            if (!await this.getDistPath(import_path)?.fsExists()) {
                // console.log("+ imp " + import_path,src_path.toString())
                await this.updateFile(import_path, true, true)
            }
        }
    }

    /**
     * copy virtual file to all compiled directories (and transpile)
     * @param virtual_path virtual path in the src dir for the virtual file
     * @param src_path file path from which to copy (opt. watch) the content
     */
    public async addVirtualFile(virtual_path:Path.File|string, src_path:Path.File, override?:boolean): Promise<Path.File>
    /**
     *  copy virtual file to all compiled directories (and transpile)
     * @param virtual_path virtual path in the src dir for the virtual file
     * @param content file content
     * @return actual file path of virtual file
     */
    public addVirtualFile(virtual_path:Path.File|string, content:string|Uint8Array, override?:boolean): Promise<Path.File>
    public addVirtualFile(virtual_path:Path.File|string, content_or_src:string|Uint8Array|Path.File, override = false) {
        const p = this.resolveRelativeSrcPath(virtual_path);
        if (!p) return;
        virtual_path = p;

        if (!override && this.#virtual_files.has(virtual_path.toString())) throw new Error("cannot add new virtual file "+virtual_path+" - already exists")
        if (virtual_path.is_dir) throw new Error("virtual file path is a directory ptah")

        this.#virtual_files.add(virtual_path.toString());

        if (content_or_src instanceof Path) return this.addVirtualSyncedFile(virtual_path, content_or_src)
        else return this.updateVirtualFile(virtual_path, content_or_src);
    }

    public virtualFileExists(virtual_path:Path.File|string) {
        const p = this.resolveRelativeSrcPath(virtual_path);
        if (!p) return false;
        virtual_path = p;
        return this.#virtual_files.has(virtual_path.toString());
    }

    private async addVirtualSyncedFile(virtual_path:Path.File, src_path:Path.File) {

        logger.info("file watcher activated for " + virtual_path);

        const path = await this.updateVirtualFile(virtual_path, await Deno.readFile(src_path.normal_pathname));
        this.syncVirtualFile(virtual_path, src_path);
        return path;
    }


    private async syncVirtualFile(virtual_path:Path.File, src_path:Path.File){
        const watcher = Deno.watchFs(src_path.pathname);
        this.#fs_watchers.set(virtual_path.toString(), watcher);

        for await (const event of watcher) {
            try {
				for (const path of event.paths) {
					const src_path = new Path(path);

                    logger.info("#color(grey)file update: " + src_path.getAsRelativeFrom(this.src_dir.parent_dir).replace(/^\.\//, ''));
                    await this.updateVirtualFile(virtual_path, await Deno.readFile(src_path.normal_pathname));
				}
            }
            catch (e) {
                console.log("file update error:",e);
            }
        }
    }

    public updateVirtualFile(virtual_path:Path.File|string, content:string|Uint8Array) {
        const p = this.resolveRelativeSrcPath(virtual_path);
        if (!p) return;
        virtual_path = p;

        if (!this.#virtual_files.has(virtual_path.toString())) throw new Error("cannot update virtual file " + virtual_path + " - does not exist")
        
        return this._updateVirtualFile(virtual_path, content);
    }

    private async _updateVirtualFile(path:Path.File|string, content:string|Uint8Array) {
        const p = this.resolveRelativeSrcPath(path);
        if (!p) return;
        path = p;

        const dist_path = this.getDistPath(path, false);
        if (!dist_path) throw new Error("could not create virtual file")
        dist_path.parent_dir.fsCreateIfNotExists();
        if (typeof content == "string") await Deno.writeTextFile(dist_path.normal_pathname, content);
        else await Deno.writeFile(dist_path.normal_pathname, content);
        // transpile?
        if (this.isTranspiledFile(dist_path)) {
            await this.transpile(dist_path, path);
        }
        return dist_path;
    }

    public deleteVirtualFile(virtual_path:Path.File|string) {
        const p = this.resolveRelativeSrcPath(virtual_path);
        if (!p) return;
        virtual_path = p;

        this.#virtual_files.delete(virtual_path.toString());
        this.#fs_watchers.get(virtual_path.toString())?.close()
        this.#fs_watchers.delete(virtual_path.toString());

        return this._deleteVirtualFile(virtual_path);
    }

    private async _deleteVirtualFile(path:Path.File) {
        const dist_path_ts = this.getDistPath(path, false);
        if (dist_path_ts && await dist_path_ts.fsExists()) await Deno.remove(dist_path_ts)

        const dist_path_js = this.getDistPath(path, true);
        if (dist_path_js && await dist_path_js.fsExists()) await Deno.remove(dist_path_js)
    }

    private transpileToJS(ts_dist_path: Path.File) {


        // check if corresponding ts file exists
        let valid = false;

        for (const [_ts_ext, _js_ext] of Object.entries(this.#options.transpile_exts)) {
            if (ts_dist_path.hasFileExtension(_ts_ext)) {
                valid = true;
                const js_path = ts_dist_path.replaceFileExtension("ts", "js").replaceFileExtension("tsx", "js").replaceFileExtension("mts", "js");
                if (js_path.fs_exists) {
                    try {Deno.removeSync(js_path)} // might still cause an error when file is deleted at the same time (transpileToJS called asynchronously two times), but should not happen
                    catch {}
                }
                break;
            }
        }

        if (!valid) throw new Error("the typescript file cannot be transpiled - not a valid file extension");

        return app.options?.experimentalFeatures.includes('embedded-reactivity') ?
            this.transpileToJSSWC(ts_dist_path):
            this.transpileToJSDenoEmit(ts_dist_path)
    }
  
    private async transpileToJSDenoEmit(ts_dist_path:Path.File) {
        const js_dist_path = this.getFileWithMappedExtension(ts_dist_path);
        try {
            const jsxOptions = ts_dist_path.hasFileExtension("tsx") ? {
                jsx: "react-jsx",
                jsxImportSource: "uix"
            } as const : null;
            // TODO: remove jsxAutomatic:true, currently only because of caching problems
            const transpiled = await transpile!(await Deno.readTextFile(ts_dist_path.normal_pathname), {
                inlineSourceMap: !!this.#options.sourceMap, 
                inlineSources: !!this.#options.sourceMap,
                ...jsxOptions
            });
            if (transpiled != undefined) await Deno.writeTextFile(js_dist_path.normal_pathname, transpiled);
            else throw "unknown error"
        }
        catch (e) {
            logger.error("could not transpile " + ts_dist_path + ": " + e.message??e);
        }
       
        return js_dist_path;
    }

    private async transpileToJSSWC(ts_dist_path: Path.File) {
        const {transformSync} = await import("npm:@swc/core");

        const js_dist_path = this.getFileWithMappedExtension(ts_dist_path);
        try {
            const transpiled = transformSync!(await Deno.readTextFile(ts_dist_path.normal_pathname), {
                jsc: {
                    parser: {
                        tsx: !!ts_dist_path.hasFileExtension("tsx"),
                        syntax: "typescript",
                        decorators: true,
                        dynamicImport: true,

                    },
                    transform: {
                        legacyDecorator: true,
                        decoratorMetadata: true,
                        react: {
                            runtime: "automatic",
                            importSource: "uix",
                            throwIfNamespace: false
                        }
                    },
                    target: "es2022",
                    keepClassNames: true,
                    externalHelpers: false,
                    experimental: {
                        plugins: [
                            ["jusix", {}]
                        ]
                    }
                }
            }).code
            if (transpiled != undefined) await Deno.writeTextFile(js_dist_path.normal_pathname, transpiled);
            else throw "unknown error"
        }
        catch (e) {
            console.log(e)
            logger.error("could not transpile " + ts_dist_path + ": " + e.message??e);
        }
       
        return js_dist_path;
    }
}
