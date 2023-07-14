import { ALLOWED_ENTRYPOINT_FILE_NAMES, normalized_app_options } from "./app.ts";
import {Path} from "unyt_node/path.ts";
import { getExistingFile, getExistingFileExclusive } from "../utils/file_utils.ts";
import { resolveEntrypointRoute, html_content, html_content_or_generator_or_preset, RenderMethod, RenderPreset, raw_content, PageProvider } from "../html/rendering.ts";
import { logger } from "../utils/global_values.ts";
import { Context, ContextGenerator, HTMLUtils } from "../uix_all.ts";
import { getOuterHTML } from "../html/render.ts";
import { Datex } from "unyt_core";
import { OPEN_GRAPH } from "../base/open_graph.ts";


export class BackendManager {
	
	srcPrefix = "/@uix/src/"

	#scope: Path
	#base_path: Path
	#web_path: Path
	#entrypoint?: Path
	#web_entrypoint?: Path
	#pagesDir?: Path
	virtualEntrypointContent?: string;
	#watch: boolean

	get watch() {return this.#watch}

	#module?: Record<string,any>
	#content_provider?: html_content_or_generator_or_preset

	get entrypoint() {
		return this.#entrypoint;
	}

	get web_entrypoint() {
		// don't use web entrypoint if static rendering for default content
		if (this.#content_provider instanceof RenderPreset && (this.#content_provider.__render_method == RenderMethod.STATIC || this.#content_provider.__render_method == RenderMethod.STATIC_NO_JS)) return undefined;
		return this.#web_entrypoint
	}
	get module() {return this.#module}
	get content_provider() {return this.#content_provider}

	constructor(app_options:normalized_app_options, scope:Path, base_path:URL, watch = false){
		this.#scope = scope;
		this.#base_path = new Path(base_path);
		this.#watch = watch;

		this.#web_path = new Path(`uix://${this.srcPrefix}${this.#scope.name}/`);
		try {
			const entrypoint_path = getExistingFileExclusive(this.#scope, ...ALLOWED_ENTRYPOINT_FILE_NAMES);

			if (entrypoint_path) {
				this.#entrypoint = new Path(entrypoint_path);
				this.#web_entrypoint = this.#web_path.getChildPath(this.#entrypoint.name).replaceFileExtension("dx", "dx.ts");
			}
			// no entrypoint, but pages directory mapping
			else if (app_options.pages) {
				this.#pagesDir = app_options.pages;
				this.virtualEntrypointContent = "console.warn('UIX.PageProvider cannot yet be mapped from the backend')"; // TODO UIX.PageProvider
				this.#web_entrypoint = this.#web_path.getChildPath("entrypoint.ts"); // virtual entrypoint, has no corresponding file in backend dir
			}

		}
		catch {
			logger.error("Only one of the following entrypoint files can exists in a directory: " + ALLOWED_ENTRYPOINT_FILE_NAMES.join(", "));
			throw "ambiguous entrypoint"
		}

		if (this.#watch) this.watchFiles();
	
	}

	async watchFiles(){
		for await (const event of Deno.watchFs(this.#scope.pathname, {recursive: true})) {
			this.restart()
		}
	}

	restart() {
		logger.info("restarting backend...");
		Deno.exit(42)
	}

	/**
	 * start entrypoint if it exists
	 * @returns default export if it exists
	 */
	async run() {
		if (this.#entrypoint) {
			const module = this.#module = <any> await datex.get(this.#entrypoint);
			this.#content_provider = module.default ?? (Object.getPrototypeOf(module) !== null ? module : null);
			// default ts export, or just the result if DX and not ts module
			await resolveEntrypointRoute(this.#content_provider); // load fully
			return this.#content_provider;
		}
		else if (this.#pagesDir) {
			logger.info(`Using ${this.#pagesDir} as pages for backend entrypoint`)
			this.#content_provider = new PageProvider(this.#pagesDir);
			// default ts export, or just the result if DX and not ts module
			await resolveEntrypointRoute(this.#content_provider); // load fully
			return this.#content_provider;
		}
		return null;
	}


	public async getEntrypointHTMLContent(path?: string, lang = 'en', context?:ContextGenerator|Context): Promise<[content:[string,string]|string|raw_content, render_method:RenderMethod, open_graph_meta_tags?:OpenGraphInformation|undefined]> {
		// extract content from provider, depending on path
		const [content, render_method, _0, _1] = await resolveEntrypointRoute(this.#content_provider, Path.Route(path), context, true);

		// raw file content
		if (content instanceof Blob || content instanceof Response) return [content, RenderMethod.RAW_CONTENT, content[OPEN_GRAPH]];

		// Markdown
		if (content instanceof Datex.Markdown) return [await getOuterHTML(<Element> content.getHTML(false), {includeShadowRoots:true, injectStandaloneJS:render_method!=RenderMethod.STATIC_NO_JS, lang}), render_method, content[OPEN_GRAPH]];

		// convert content to valid HTML string
		if (content instanceof Element || content instanceof DocumentFragment) return [await getOuterHTML(content, {includeShadowRoots:true, injectStandaloneJS:render_method!=RenderMethod.STATIC_NO_JS, lang}), render_method, content[OPEN_GRAPH]];
		else return [HTMLUtils.escapeHtml(content?.toString() ?? ""), render_method, content?.[OPEN_GRAPH]];
	}

}