import { Datex } from "datex-core-legacy";
import { resolveEntrypointRoute } from "../routing/rendering.ts";
import { Context } from "../routing/context.ts";
import { convertANSIToHTML } from "../utils/ansi-to-html.ts";
import { Path } from "../utils/path.ts";
import { getCallerFile } from "datex-core-legacy/utils/caller_metadata.ts";
import { setCookie, Cookie } from "../lib/cookie/cookie.ts";
import { ALLOWED_ENTRYPOINT_FILE_NAMES, app } from "../app/app.ts";
import { Entrypoint, RouteHandler, html_generator } from "./entrypoints.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { HTTPStatus } from "./http-status.ts";
import { createErrorHTML } from "./errors.tsx";
import { HTTPError } from "./http-error.ts";
import { convertToWebPath } from "../app/convert-to-web-path.ts";
import { getJSONCompatibleSerializedValue } from "../utils/serialize-js.ts";

const fileServer = client_type === "deno" ? (await import("https://deno.land/std@0.164.0/http/file_server.ts")) : null;

type mime_type = `${'text'|'image'|'application'|'video'|'audio'}/${string}`;
type json_mime_type = `application/${string}+json`;

export function lazy<T extends html_generator>(generator: T): T {
	let result:Awaited<ReturnType<T>>|undefined;
	let loaded = false;
	return (async function(ctx: Context) {
		if (loaded) return result;
		else {
			result = await generator(ctx, ctx.params) as any;
			loaded = true;
			return result;
		}
	}) as any
}

// TODO: remove, deprecated
/**
 * @deprecated, use lazy instead
 */
export const once = lazy

/**
 * serve a value as raw content (DX, DXB, JSON format)
 * @param value any JS value (must be JSON compatible if JSON is used as the content type)
 * @param options optional options:
 * 	type: Datex.FILE_TYPE (DX, DXB, JSON)
 *  formatted: boolean if true, the DX/JSON is formatted with newlines/spaces
 *  mimeType: custom mime type if type is JSON
 * @returns blob containing DATEX/JSON encoded value
 */
export async function provideValue(value:unknown, options?:{type?:Datex.DATEX_FILE_TYPE, formatted?:boolean, mockPointers?:boolean, mimeType?: json_mime_type}) {
	if (options?.type == Datex.FILE_TYPE.DATEX_BINARY) {
		return provideContent(await Datex.Compiler.compile("?", [value]) as ArrayBuffer, options.type[0])
	}
	else if (options?.type == Datex.FILE_TYPE.JSON) {
		if (options?.mockPointers) value = getJSONCompatibleSerializedValue(value);
		return provideContent(JSON.stringify(value??null, null, options?.formatted ? '    ' : undefined), options.mimeType ?? options.type[0])
	}
	else {
		return provideContent(Datex.Runtime.valueToDatexStringExperimental(value, options?.formatted), (options?.type ?? Datex.FILE_TYPE.DATEX_SCRIPT)[0])
	}
}

/**
 * serve a value as JSON
 * @param value any JSON compatible value
 * @param options optional options:
 *  formatted: boolean if true, the DX/JSON is formatted with newlines/spaces
 *  mimeType: custom mime type (e.g. "application/geo+json")
 * @returns blob containing DATEX/JSON encoded value
 */
export function provideJSON(value:unknown, options?:{formatted?:boolean, mimeType?: json_mime_type}) {
	return provideValue(value, {formatted: options?.formatted, type: Datex.FILE_TYPE.JSON, mimeType:options?.mimeType})
}



/**
 * Show an interactive value view in the browser, including syntax highlighting
 * @param value 
 */
export function provideValueDebugView(value: unknown) {
 	const dxString = Datex.Runtime.valueToDatexStringExperimental(value, true, true, true, true);
	const html = `<html style="color: white;background: #111111;padding: 10px;line-height: 1.2rem;">
		<head>	
			<meta charset="UTF-8">
			<style>
				body span {
					line-height: 1.2rem!important;
				}
			</style>
		</head>
		${convertANSIToHTML(dxString)}
	</html>`
	return provideResponse(html, "text/html;charset=utf-8");
}
// export function provideValueDebugView(value: unknown) {
// 	const dxString = Datex.Runtime.valueToDatexStringExperimental(value);
// 	const page = `
// 	<!DOCTYPE html>
// 	<html lang="en">
// 		<head>
// 			<meta charset="UTF-8">
// 			<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
// 			<title>UXI Value Debug View</title>
// 			<link rel="icon" href="https://dev.cdn.unyt.org/unyt_core/assets/square_dark.png">
// 			<script type="importmap">
				
// 			{
// 				"imports": {
// 					"unyt_core": "https://dev.cdn.unyt.org/unyt_core/datex.ts",
// 					"uix": "https://dev.cdn.unyt.org/uix/uix.ts",
// 					"unyt_core/": "https://dev.cdn.unyt.org/unyt_core/",
// 					"uix/": "https://dev.cdn.unyt.org/uix/",
// 					"uix_std/": "https://dev.cdn.unyt.org/uix/uix_std/",
// 					"unyt_tests/": "https://dev.cdn.unyt.org/unyt_tests/",
// 					"unyt_web/": "https://dev.cdn.unyt.org/unyt_web/",
// 					"unyt_node/": "https://dev.cdn.unyt.org/unyt_node/",
// 					"unyt_cli/": "https://dev.cdn.unyt.org/unyt_cli/",
// 					"supranet/": "https://portal.unyt.org/ts_module_resolver/",
// 					"uix/jsx-runtime": "https://dev.cdn.unyt.org/uix/jsx-runtime/jsx.ts",
// 					"backend/": "/@uix/src/backend/",
// 					"common/": "/@uix/src/common/",
// 					"frontend/": "/@uix/src/frontend/"
// 				}
// 			}
			
// 			</script>
// 			<script type="module">
// 				import { datex, Datex } from "datex-core-legacy";
// 				import { DatexValueTreeView } from "uix_std/datex/value_tree_view.ts"
// 				import { dx_value_manager } from "uix_std/datex/resource_manager.ts";

// 				await Datex.Supranet.connect();
// 				const value = await datex \`${dxString}\`;

// 				console.log("${dxString}", value);
// 				const tree_view = new DatexValueTreeView({
// 					root_resource_path:(await dx_value_manager.getResourceForValue(value)).path,
// 					header:false, 
// 					enable_drop:false,
// 					display_root: true
// 				}, {dynamic_size:false});
// 				document.body.append(tree_view)
// 			</script>
// 		</head>
// 	</html>	
// 	`
// 	return provideResponse(page, "text/html");
// }



export function provideResponse(content:ReadableStream | XMLHttpRequestBodyInit, type:mime_type, status = 200, cookies?:Cookie[], headers:Record<string, string> = {}, cors = false) {
	if (cors) Object.assign(headers, {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"});
	Object.assign(headers, {"Content-Type": type});
	const res = new Response(content, {headers, status});
	if (cookies) {
		for (const cookie of cookies) setCookie!(res.headers, cookie);
	}
	return res;
}

/**
 * serve a string/ArrayBuffer with a specific mime type
 * @param content 'file' content
 * @param type mime type
 * @returns content blob
 */
export async function provideContent(content:string|ArrayBuffer, type:mime_type = "text/plain;charset=utf-8", status?:number) {
	const blob = new Blob([content], {type});
	await Datex.Runtime.cacheValue(blob);
	return provideResponse(blob, type, status);
}

/**
 * serve a file
 * @param path local file path
 * @returns content FSFile
 */
export function provideFile(path:string|URL) {
	const resolvedPath = new Path(path, getCallerFile());
	return () => Deno.open(resolvedPath);
}

/**
 * Just returns a URL, which is interpreted as redirect by the entrypoint resolver
 * @param path local file path or URL
 * @returns resolved URL
 */
export function provideRedirect(path:string|URL) {
	if (path instanceof URL) return path;
	else if (path.startsWith("/")) return Path.Route(path);
	else return new Path(path, getCallerFile());
}

/**
 * Similar to provideRedirect/returning a URL, but no redirect on the client - the
 * content is just served for the current URL
 * uses the internal UIX server to resolve a url to a response
 * @param path local file path or URL
 * @returns redirect response
 */
export function provideVirtualRedirect(path:string|URL) {
	const resolvedPath = path instanceof URL ? path : new Path(path, getCallerFile());
	const webPath = convertToWebPath(resolvedPath);

	return (ctx: Context) => {
		// a URL is required, the domain is not really relevant, but copied from request origin
		const origin = new URL(ctx.request?.url??'https://_virtual_redirect.unyt.org').origin
		// request headers also copied from request
		const request = new Request(new URL(origin + webPath), {headers:ctx.request?.headers})
		return app.defaultServer!.getResponse(request)
	}
}

const matchURL = /\b((https?|file):\/\/[^\s]+(\:\d+)?(\:\d+)?\b)/g;


/**
 * Creates an Error View
 * @param message error title
 * @param status http status code or error
 * @returns
 */
export function provideError(title: string, error?: Error|number|HTTPStatus<number,string>|string) {
	const [statusCode, html] = createErrorHTML(title, error);
	return new HTTPStatus(statusCode, html)
}

// /**
//  * @deprecated return/throw a new HTTPError or an Error instead
//  * serve an errror with a status code and message
//  * @param message error message
//  * @param status http status code
//  * @returns content blob
//  */
// export function provideError(message: string, status:number|HTTPStatus = 500) {
// 	status = typeof status == "number" ? status : status.code;
// 	const content = indent `
// 	<html>
// 		<head>
// 			<meta charset="UTF-8">
// 			<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
// 		</head>
	
// 		<body>
// 			<div style="
// 				width: 100%;
// 				height: 100%;
// 				display: flex;
// 				justify-content: center;
// 				align-items: center;
// 				font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
// 				font-size: 1.5em;
// 				color: var(--text_highlight);">
// 				<div style="text-align:center; word-break: break-word;">
// 					<h2 style="margin-bottom:0; background: #ea2b51; -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Error ${status}</h2>
// 					<div>${message}</div>
// 				</div>
// 			</div>
// 		</body>
// 	</html>
// 	`;
// 	return provideContent(content, "text/html", status);
// }



/**
 * Provide static files, backend only
 */
export class FileProvider implements RouteHandler {

	#path: Path

	get path() {return this.#path}

	constructor(path:Path.representation, public resolveIndexHTML = true, public allowHTMLWithoutExtension = true) {
		this.#path = new Path(path, getCallerFile());
		if (this.#path.fs_is_dir) this.#path = this.#path.asDir()
	}

	getRoute(route:Path.route_representation|string, context: Context) {
		if (!context.request) return provideError("Cannot serve file");

		let path = this.#path.getChildPath(route);
		
		// dir path -> index.html
		if (path.fs_is_dir && this.resolveIndexHTML) {
			path = path.getChildPath("index.html");
		}

		// file not found
		if (!path.fs_exists) {
			// .html?
			if (this.allowHTMLWithoutExtension && path.getWithFileExtension("html").fs_exists) {
				path = path.getWithFileExtension("html");
			}
			else return new HTTPError(HTTPStatus.NOT_FOUND)
		}

		return fileServer!.serveFile(context.request, path.normal_pathname);
	}
}

export const KEEP_CONTENT = Symbol("KEEP_CONTENT")


export class PageProvider implements RouteHandler {

	path!: Path
	useDirective?: string

	/**
	 * 
	 * @param path 
	 * @param useDirective optional use directive required for a entrypoint to be loaded (e.g. "use backend")
	 *	If a use directive is present in an entrypoint file, but not useDirective value is set, the entrypoint is not loaded.
	 */
	constructor(path:Path.representation, useDirective?: string) {
		this.useDirective = useDirective;
		this.path = new Path(path, getCallerFile());
		if (this.path.fs_is_dir) this.path = this.path.asDir()
	}

	getRoute(route: Path.route_representation, context: Context): Entrypoint|Promise<Entrypoint> {
		if (!this.path) return KEEP_CONTENT // loaded a PageProvider from backend, path not known, cannot resolve (TODO)
		return this.#findValidEntrypoint(
			this.path.getChildPath(route).asDir(), 
			ALLOWED_ENTRYPOINT_FILE_NAMES
		) 
	}

	async #findValidEntrypoint(parentDir: Path, names: string[], redirectRoute:string[] = []): Promise<Entrypoint|null> {
		for (const name of names) {
			try {
				const url = parentDir.getChildPath(name);
				// make sure use directive matches
				
				// browser: fetch file only if useDirective is present in file, otherwise not found is returned
				if (client_type == "browser") url.searchParams.append("useDirective", this.useDirective??"")
				// deno: read file and check if use directive matches, otherwise return null
				else {
					if (url.fs_exists && !await PageProvider.useDirectiveMatchesForFile(url, this.useDirective)) {
						// console.log("use directive '" + (this.useDirective??'') + "' does not match for " + url)
						return null;
					}
				}
			
				// make sure another directive

				
				const entrypoint = (await datex.get<any>(url))!.default as Entrypoint;
				// resolve route for entrypoint
				if (redirectRoute.length) {
					// TODO: #14
					const { content } = await resolveEntrypointRoute({entrypoint, route: Path.Route(redirectRoute)});
					return content as Entrypoint;
				}
				// return entrypoint directly
				return entrypoint;
			}
			catch (e){
				// Error 406, because the use directive of the file does not match
				// -> don't go up further in the file tree, just stop here and return null content
				// TODO: better way?
				if (e.message.endsWith("(406)")) return null;
				// Any other unexpected error besides 404/not found, throw error
				if (!e.message.endsWith("(404)") && !e.message.includes("No such file or directory")) throw e;
			}
		}

		// no entrypoint in directory, find entrypoint in parent directory
		if (parentDir.parent_dir.toString() !== parentDir.toString()) {
			redirectRoute.unshift(parentDir.name);
			return this.#findValidEntrypoint(parentDir.parent_dir, names, redirectRoute)
		}
	}

	static async useDirectiveMatchesForFile(path: Path, directive?:string) {
		const file = (await Deno.readTextFile(path.normal_pathname)).trimStart();
		if (directive) {
			// does not have the required use directive
			if (!file.startsWith(`"use ${directive}"`)) return false;
		} 
		else {
			// has a use directive, although know use directive should be present
			if (file.match(/^"use [\w-]+"/)) return false;
		}
		return true;
	}
		
}