import { ALLOWED_ENTRYPOINT_FILE_NAMES, normalized_app_options } from "./app.ts";
import {Path} from "unyt_node/path.ts";
import { getExistingFile, getExistingFileExclusive } from "../utils/file_utils.ts";
import { collapseToContent, html_content_or_generator_or_preset, RenderMethod, RenderPreset } from "../html/rendering.ts";
import { logger } from "../utils/global_values.ts";
import { HTMLUtils } from "../uix_all.ts";


export class BackendManager {
	
	#scope: Path
	#web_path: Path
	#entrypoint?: Path
	#web_entrypoint?: Path
	#watch: boolean

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
		this.#watch = watch;

		this.#web_path = new Path(`uix:///@${this.#scope.name}/`);
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
			logger.info("restarting backend...");
			Deno.exit(42)
		}
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
			return this.#content_provider;
		}
		return null;
	}


	public getEntrypointHTMLContent(path?: string) {
		// extract content from provider, depending on path
		const content = collapseToContent(this.#content_provider, path, true);
		
		// convert content to valid HTML string
		if (content instanceof HTMLElement) return content.outerHTML;
		else return HTMLUtils.escapeHtml(content?.toString() ?? "");
	}

}