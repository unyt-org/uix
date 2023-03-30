import { ALLOWED_ENTRYPOINT_FILE_NAMES, normalized_app_options } from "./app.ts";
import {Path} from "unyt_node/path.ts";
import { getExistingFile, getExistingFileExclusive } from "../utils/file_utils.ts";
import { resolveEntrypointRoute, html_content, html_content_or_generator_or_preset, RenderMethod, RenderPreset, raw_content } from "../html/rendering.ts";
import { logger } from "../utils/global_values.ts";
import { Context, ContextGenerator, HTMLUtils } from "../uix_all.ts";
import { Routing } from "../base/routing.ts";
import { Base } from "../components/base.ts";
import { getOuterHTML } from "../html/render.ts";
import { Datex } from "unyt_core/datex.ts";


export class BackendManager {
	
	srcPrefix = "/@uix/src/"

	#scope: Path
	#base_path: Path
	#web_path: Path
	#entrypoint?: Path
	#web_entrypoint?: Path
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
		this.#base_path = base_path;
		this.#watch = watch;

		this.#web_path = new Path(`uix://${this.srcPrefix}${this.#scope.name}/`);
		try {
			const entrypoint_path = getExistingFileExclusive(this.#scope, ...ALLOWED_ENTRYPOINT_FILE_NAMES);
			this.#entrypoint = entrypoint_path ? new Path(entrypoint_path) : undefined;
			this.#web_entrypoint = this.#entrypoint ? this.#web_path.getChildPath(this.#entrypoint.name).replaceFileExtension("dx", "dx.ts") : undefined;
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
		return null;
	}


	public async getEntrypointHTMLContent(path?: string, context?:ContextGenerator|Context): Promise<[content:string|raw_content, render_method:RenderMethod]> {
		// extract content from provider, depending on path
		const [content, render_method] = await resolveEntrypointRoute(this.#content_provider, Path.Route(path), context, true);

		// raw file content
		if (content instanceof Blob || content instanceof Response) return [content, RenderMethod.RAW_CONTENT];

		// Markdown
		if (content instanceof Datex.Markdown) return [await getOuterHTML(<HTMLElement> content.getHTML(false), {includeShadowRoots:true, rootDir:this.#base_path, injectStandaloneJS:true}), render_method];

		// convert content to valid HTML string
		if (content instanceof HTMLElement || content instanceof DocumentFragment) return [await getOuterHTML(content, {includeShadowRoots:true, rootDir:this.#base_path, injectStandaloneJS:true}), render_method];
		else return [HTMLUtils.escapeHtml(content?.toString() ?? ""), render_method];
	}

}