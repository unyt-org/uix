import { ALLOWED_ENTRYPOINT_FILE_NAMES, normalized_app_options } from "./app.ts";
import {Path} from "unyt_node/path.ts";
import { getExistingFile, getExistingFileExclusive } from "../utils/file_utils.ts";
import { collapseToContent, html_content_or_generator_or_preset, RenderMethod, RenderPreset } from "../html/rendering.ts";
import { logger } from "../utils/global_values.ts";

export class BackendManager {
	
	#scope: Path
	#web_path: Path
	#entrypoint?: Path
	#web_entrypoint?: Path

	#module?: Record<string,any>
	#default?: html_content_or_generator_or_preset

	get entrypoint() {
		return this.#entrypoint;
	}

	get web_entrypoint() {
		// don't use web entrypoint if static rendering for default content
		if (this.#default instanceof RenderPreset && (this.#default.__render_method == RenderMethod.STATIC || this.#default.__render_method == RenderMethod.STATIC_NO_JS)) return undefined;
		return this.#web_entrypoint
	}
	get module() {return this.#module}
	get default() {return this.#default}

	constructor(app_options:normalized_app_options, scope:Path, base_path:URL){
		this.#scope = scope;

		this.#web_path = new Path(`uix:///@${this.#scope.name}/`);
		try {
			const entrypoint_path = getExistingFileExclusive(this.#scope, ...ALLOWED_ENTRYPOINT_FILE_NAMES);
			console.log("path",entrypoint_path)
			this.#entrypoint = entrypoint_path ? new Path(entrypoint_path) : undefined;
			this.#web_entrypoint = this.#entrypoint ? this.#web_path.getChildPath(this.#entrypoint.name).replaceFileExtension("dx", "dx.ts") : undefined;
		}
		catch {
			logger.error("Only one of the following entrypoint files can exists in a directory: " + ALLOWED_ENTRYPOINT_FILE_NAMES.join(", "));
			throw "ambiguous entrypoint"
		}
	
	}

	/**
	 * start entrypoint if it exists
	 * @returns default export if it exists
	 */
	async run() {
		if (this.#entrypoint) {
			const module = this.#module = <any> await datex.get(this.#entrypoint);
			this.#default = module.default ?? (Object.getPrototypeOf(module) !== null ? module : null);
			// default ts export, or just the result if DX and not ts module
			return this.#default;
		}
		return null;
	}


	public getEntrypointHTMLContent() {
		// only serve content via DATEX, no server side prerendering:
		if (this.#default instanceof RenderPreset && this.#default.__render_method == RenderMethod.DYNAMIC) return undefined;
		const content = this.#default !== undefined ? collapseToContent(this.#default) : undefined;
		
		// convert content to valid HTML string
		if (content instanceof HTMLElement) return content.outerHTML;
	}

}