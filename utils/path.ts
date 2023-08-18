// deno-lint-ignore-file no-namespace
const relative = globalThis.Deno ? (await import("https://deno.land/std@0.172.0/path/mod.ts")).relative : null;
import { getCallerFile } from "unyt_core/utils/caller_metadata.ts";

export class Path<P extends Path.protocol = Path.protocol, IsDir extends boolean = boolean> extends URL {

	declare protocol: P


	constructor(path:Path.representation = "./", base?:string|URL) {
		path = Path.#formatPath(path, !base);
		if (!base && !Path.pathIsURL(path)) base = getCallerFile() // resolve path relative to caller file

		super(path, base);
	}

	// convert to dir/ path
	static dir<P extends Path.protocol = Path.protocol>(path?:Path.representation, base?:Path<P, boolean>): Path<P, true>
	static dir(path?:Path.representation, base?:string|URL): Path<Path.protocol, true>
	static dir(path:Path.representation = "./", base?:string|URL) {
		path = Path.#formatPath(path, !base);
		if (!base && !Path.pathIsURL(path)) base = getCallerFile() // resolve path relative to caller file
		
		if (!path.toString().endsWith("/")) path = path.toString() + "/"; // make sure its a dir path
		return new Path<Path.protocol, true>(path, base);
	}

	// convert to file/ path
	static file<P extends Path.protocol = Path.protocol>(path?:Path.representation, base?:Path<P, boolean>): Path<P, false>
	static file(path?:Path.representation, base?:string|URL): Path<Path.protocol, false>
	static file(path:Path.representation = "./", base?:string|URL) {
		path = Path.#formatPath(path, !base);
		if (!base && !Path.pathIsURL(path)) base = getCallerFile() // resolve path relative to caller file

		if (path.toString().endsWith("/")) path = path.toString().slice(0, -1); // make sure its a file path
		return new Path<Path.protocol, false>(path, base);
	}

	// get path for current working directory
	static cwd(){
		return new Path(globalThis.Deno ? Deno.cwd() : window.location.href);
	}

	/**
	 * returns true if the two routes are exactly equal
	 * @param routeA
	 * @param routeB 
	 */
	static routesAreEqual(routeA: Path.route_representation, routeB: Path.route_representation) {
		routeA = routeA instanceof Path ? routeA : Path.Route(routeA);
		routeB = routeB instanceof Path ? routeB : Path.Route(routeB);
		// check if all route sections are the same
		return JSON.stringify(routeA.route) === JSON.stringify(routeB.route)
	}

	/**
	 * converts Path.representation to URL for absolute paths, or string for relative paths
	 * @param path 
	 * @returns 
	 */
	static #formatPath(path:Path.representation, abs_path_as_file_path = true) {
		// absolute url
		if (path instanceof URL) return path;
		else if (typeof path == "string" && path.match(/^[A-Za-z0-9]+\:/)) return new URL(path);

		// string, string []
		if (path instanceof Array) path = './'+path.join('/').replace(/^\//,''); // join, make relative and remove duplicate / at beginning
		// for deno: absolute path becomes file path, not relative to origin
		if (abs_path_as_file_path && globalThis.Deno) {
			if (typeof path == "string" && path.startsWith("/")) path = new URL(Path.DEFAULT_PROTOCOL + (Path.ProtocolDefaultPrefixes[<keyof typeof Path.ProtocolDefaultPrefixes>Path.DEFAULT_PROTOCOL]??'') + path); // default to DEFAULT_PROTOCOL for absolute paths
		}
		if (typeof path == "string" && !(path.startsWith("/") || path.startsWith("./") || path.startsWith("../"))) path = "./" + path // assume file relative path without ./
		return path;
	}
	// returns true if the path is a URL or an url string
	static pathIsURL(path:string|URL) {
		return path instanceof URL || path.match(/^[A-Za-z0-9]+\:/);
	}


	// returns true if protocol is http(s)
	get is_web() {
		return this.protocol == <P>"http:" || this.protocol == <P>"https:"
	}

	isWeb(): this is Path<'https:'|'http:'> {
		return this.protocol == <P>"http:" || this.protocol == <P>"https:"
	}

	// returns true if pathname ends with /
	get is_dir(): IsDir {
		return <IsDir> this.pathname.endsWith("/")
	}

	isDir(): this is Path<P, true> {
		return this.pathname.endsWith("/")
	}

	/**
	 * get the root path (e.g. file://)
	 */
	get root(){
		return this.protocol + "//"
	}

	/**
	 * is true if the path is an actual directory in the file system
	 */
	get fs_is_dir() {
		if (this.is_web) return false;
		if (!globalThis.Deno) throw new Error("filesystem operations not supported");
		if (!this.fs_exists) return false;
		return Deno.statSync(this.normal_pathname).isDirectory;
	}

	/**
	 * path sections as array
	 */
	get path(){
		const path = this.pathname.slice(1).split("/");
		if (path.at(-1) === "") path.pop();
		return path
	}

	/**
	 * route sections (path + hash) as array
	 */
	get route(){
		const route = this.routename.slice(1).split("/");
		if (route.at(-1) === "") route.pop();
		return route
	}

	/**
	 * filename extracted from pathname
	 */
	get filename() {
		if (this.is_dir) throw new Error("path is directory");
		const path = this.path
		return path[path.length-1];
	}

	/**
	 * directory name extracted from pathname
	 */
	get dirname() {
		if (!this.is_dir) throw new Error("path is file");
		const path = this.path
		return path[path.length-1];
	}

	/**
	 * filename or directory name
	 */
	get name(){
		if (this.is_dir) return this.dirname;
		else return this.filename
	}

	/**
	 * full path + hash
	 */
	get routename() {
		return this.pathname + this.hash;
	}

	/**
	 * the last extension (everything after the last '.')
	 */
	get ext(){
		return this.pathname.match(/\.([^\.\/\\]+)$/)?.[1]
	}

	/**
	 * an array of all extensions, sorted from last to first
	 */
	get exts(){
		return this.pathname.match(/(\.([^\.\/\\]+))+$/)?.[0].split(".").slice(1).reverse()
	}

	/**
	 * parent directory
	 */
	get parent_dir(): Path {
		return this.is_dir ? new Path('../', this) : new Path('./', this);
	}

	/**
	 * get pathname for filesystems, not encoded for URLs
	 */
	get normal_pathname() {
		return decodeURIComponent(this.pathname)
	}

	/**
	 * true if file/directory exists in filesystem
	 */
	get fs_exists() {
		if (this.is_web) return false;
		if (!globalThis.Deno) throw new Error("filesystem operations not supported");
		try {
			Deno.statSync(this.normal_pathname);
			return true
        } 
        catch {
			return false
		}
	}

	/**
	 * returns true if web path returns OK status
	 * @returns 
	 */
	async webExists() {
		if (!this.is_web) return false;
		try {
			return (await fetch(this)).ok
        } 
        catch {
			return false
		}
	}

	/**
	 * returns true if path exists on filesystem or web
	 * @returns 
	 */
	async exists() {
		return this.fs_exists || await this.webExists();
	}

	/**
	 * Returns the path content as an ArrayBuffer.
	 * Fetches from web if http[s]:// url, loads local file content (in deno), if file:// url
	 */
	async getContent() {
		if (this.is_web) {
			return (await fetch(this)).arrayBuffer()
		}
		else {
			return Deno.readFile(this);
		}
	}

	/**
	 * Returns the path content as a string.
	 * Fetches from web if http[s]:// url, loads local file content (in deno), if file:// url
	 */
	async getTextContent() {
		if (this.is_web) {
			return (await fetch(this)).text()
		}
		else {
			return Deno.readTextFile(this);
		}
	}


	/**
	 * Returns the first extension from the given extensions that matches the current path
	 * @param extensions list of file extensions (without a leading ".")
	 * @returns 
	 */
	hasFileExtension(...extensions:string[]) {
		for (const extension of extensions) {
			if (this.pathname.endsWith("." + extension)) return extension;
		}
		return false;
	}

	/**
	 * Returns a new Path without the file extension
	 * @param remove_all remove all extensions (e.g .tar.gz)
	 * @returns 
	 */
	getWithoutFileExtension(remove_all = false): Path<P, IsDir> {
		if (remove_all) return new Path(this.toString().replace(/(\.[^\.\/\\]+)+$/, ""))
		else return new Path(this.toString().replace(/\.[^\.\/\\]+$/, ""))
	}

	/**
	 * Returns a new Path with a different file extension
	 * @param ext the new file extension
	 * @param replace_all replace  all extensions (e.g .tar.gz)
	 * @returns 
	 */
	getWithFileExtension(ext:string, replace_all = false): Path<P, IsDir> {
		if (this.ext) {
			if (replace_all) return new Path(this.toString().replace(/(\.[^\.\/\\]+)+$/, "." + ext))
			else return new Path(this.toString().replace(/\.[^\.\/\\]+$/, "." + ext))
		}
		else {
			if (this.is_dir) return new Path(this.toString().slice(0, -1) + "." + ext + "/");
			else return new Path(this.toString() + "." + ext);
		}
	}

	/**
	 * Replaces a given file extension with a different extension and returns a new Path
	 * @param prev
	 * @param ext 
	 * @returns 
	 */
	replaceFileExtension(prev:string, ext:string): Path<P, IsDir> {
		return new Path(this.toString().replace(new RegExp('\\.' + prev.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") /* escape string for regex */ + '$'), "." + ext))
	}

	/**
	 * Gets child path, existing hash is lost
	 * throws an error if the current path is not a directory path
	 * @param child child path representation (must be relative or Path with route protocol type)
	 * @returns 
	 */
	getChildPath(child: string|string[]|Path.Route):Path<P, boolean> {
		if (!this.is_dir) throw new Error("cannot get child path of non-directory path");
		// make sure it is a relative path
		let formatted_child = Path.#formatPath(child, false);
		if (typeof formatted_child == "string" && formatted_child.startsWith("/")) formatted_child = formatted_child.slice(1);
		// invalid - child is absolute url
		if (formatted_child instanceof URL) {
			if (formatted_child.protocol === Path.RouteProtocol) formatted_child = "." + formatted_child.pathname + formatted_child.hash;
			else throw new Error("invalid child path: " + child + " - cannot be an absolute URL");
		} 
		return new Path(formatted_child, this);
	}

	/**
	 * Gets child route, keep hash routes
	 * @param child child route
	 */
	getChildRoute(child: string|string[]|Path.Route) {
		let formatted_child = Path.#formatPath(child, false);
		// invalid - child is absolute url
		if (formatted_child instanceof URL) {
			if (formatted_child.protocol === Path.RouteProtocol) formatted_child = formatted_child.pathname + formatted_child.hash;
			else throw new Error("invalid child path: " + child + " - cannot be an absolute URL");
		} 
		let current_path = this.toString();
		if (!current_path.endsWith("/")) current_path += "/";
		if (formatted_child.startsWith("/")) formatted_child = formatted_child.slice(1);
		else if (formatted_child.startsWith("./")) formatted_child = formatted_child.slice(2);
		else if (formatted_child.startsWith("../")) throw new Error("cannot resolve child route " + formatted_child);

		return new Path(current_path + formatted_child);
	}

	getWithChangedParent<P extends Path.protocol>(from:string|URL, to:Path<P>): Path<P, IsDir>
	getWithChangedParent(from:string|URL, to:string|URL): Path<Path.protocol, IsDir>
	getWithChangedParent(from:string|URL, to:string|URL) {
		const from_path = new Path(from);
		const to_path = new Path(to);
		return new Path(this.toString().replace(from_path.toString(), to_path.toString()))
	}

	getAsRelativeFrom(path:string|URL) {
		let _path = new Path(path);
		if (!_path.is_dir) _path = _path.parent_dir;

		if (!relative) throw new Error("relative path utils only supported in deno")
		let rel = relative(_path.pathname, this.pathname);
		if (!(rel.startsWith("./") || rel.startsWith("../"))) rel = "./" + rel;
		if (this.is_dir && !rel.endsWith("/")) rel += "/";

		// re-add query params
		if (this.search) rel += this.search;
		
		return rel;
	}

	asDir(): Path<P, true> {
		return Path.dir(this);
	}

	// convert to dir if fs dir, otherwise file
	asFSPath(): Path<P, boolean> {
		if (this.fs_is_dir) return Path.dir(this);
		else return Path.file(this);
	}

	isChildOf (parent_path:string|URL) {
		parent_path = new Path(parent_path);
		return this.parent_dir.toString().startsWith(parent_path.toString())
	}

	// filesystem utils - create dir
	fsCreateIfNotExists(){
		if (!globalThis.Deno) throw new Error("filesystem operations not supported");
		if (!this.is_dir) throw new Error("cannot create directory for non-directory path");

		try {
			Deno.statSync(this)
		}
		catch {
			Deno.mkdirSync(this, {recursive: true});
		}
	}

}

export namespace Path {

	export type representation = string|string[]|URL;
	export type route_representation = string[]|Path.Route;

	export type protocol = `${string}:`

	export enum Protocol {
		HTTP = 'http:',
		HTTPS = 'https:',
		File = 'file:',
	}

	export const DEFAULT_PROTOCOL:Path.protocol = Protocol.File;

	export const ProtocolDefaultPrefixes = {
		[Protocol.HTTP]: '//unknown',
		[Protocol.HTTPS]: '//unknown',
		[Protocol.File]: '//',
	} as const

	export const RouteProtocol = 'route:' satisfies protocol;

	function getPathWithProtocol<T extends protocol>(path: representation|undefined, protocol: T) {
		// change protocol
		if ((path instanceof URL || typeof path == "string") && Path.pathIsURL(path) && !path.toString().startsWith(protocol)) {
			path = new Path(path.toString()).routename;
		}
		return new Path<T>(path, protocol + (ProtocolDefaultPrefixes[<keyof typeof ProtocolDefaultPrefixes>protocol]??'/'))
	}

	export function HTTP(path?: representation) {
		return getPathWithProtocol(path, Protocol.HTTP)
	}
	export function HTTPS(path?: representation) {
		return getPathWithProtocol(path, Protocol.HTTPS)
	}
	export function File(path?: representation) {
		return getPathWithProtocol(path, Protocol.File)
	}
	export function Route(path?: representation) {
		return getPathWithProtocol(path, RouteProtocol)
	}

	export type HTTP = ReturnType<typeof HTTP>
	export type HTTPS = ReturnType<typeof HTTPS>
	export type File = ReturnType<typeof File>
	export type Route = ReturnType<typeof Route>

}