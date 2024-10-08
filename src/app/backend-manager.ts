import { ALLOWED_ENTRYPOINT_FILE_NAMES, app } from "./app.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { getExistingFileExclusive } from "../utils/file-utils.ts";
import { resolveEntrypointRoute } from "../routing/rendering.ts";
import { logger } from "../utils/global-values.ts";
import { PageProvider } from "../providers/common.tsx";
import { RenderMethod, RenderPreset } from "../base/render-methods.ts";
import { Entrypoint } from "../providers/entrypoints.ts";
import type { normalizedAppOptions } from "./options.ts";
import { createBackendEntrypointProxy } from "../routing/backend-entrypoint-proxy.ts";
import { eternalExts, updateEternalFile } from "./module-mapping.ts";

/**
 * Manages a backend endpoint deno instance
 */
export class BackendManager {
	
	srcPrefix = "/@uix/src/"

	#scope: Path.File
	#basePath: Path.File
	#web_path: Path
	#entrypoint?: Path.File
	#web_entrypoint?: Path
	#pagesDir?: Path.File
	virtualEntrypointContent?: string;
	#watch: boolean|"info"

	get watch() {return this.#watch}

	#module?: Record<string,any>
	#content_provider?: Entrypoint

	get entrypoint() {
		return this.#entrypoint;
	}

	get scope() {return this.#scope}

	get web_entrypoint() {
		// don't use web entrypoint if static rendering for default content
		if (this.#content_provider instanceof RenderPreset && (this.#content_provider.__render_method == RenderMethod.BACKEND || this.#content_provider.__render_method == RenderMethod.STATIC)) return undefined;
		return this.#web_entrypoint
	}
	get module() {return this.#module}
	get content_provider() {return this.#content_provider}

	#entrypointProxy?: Function;
	get entrypointProxy() {
		if (!this.#entrypointProxy) this.#entrypointProxy = createBackendEntrypointProxy(this.content_provider);
		return this.#entrypointProxy;
	}

	constructor(appOptions:normalizedAppOptions, scope:Path.File, basePath:URL, watch:boolean|"info" = false){
		this.#scope = scope;
		this.#basePath = Path.File(basePath);
		this.#watch = watch;

		this.#web_path = new Path(`uix://${this.srcPrefix}${this.#scope.name}/`);
		try {
			const entrypoint_path = getExistingFileExclusive(this.#scope, ...ALLOWED_ENTRYPOINT_FILE_NAMES);

			if (entrypoint_path) {
				this.#entrypoint = new Path(entrypoint_path);
				this.#web_entrypoint = this.#web_path.getChildPath(this.#entrypoint.name).replaceFileExtension("dx", "dx.ts");
			}
			// no entrypoint, but pages directory mapping
			else if (appOptions.pages) {
				this.#pagesDir = appOptions.pages;
				this.virtualEntrypointContent = "console.warn('PageProvider cannot yet be properly mapped from the backend'); export default {};"; // TODO UIX.PageProvider
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
		let handling = false;
		for await (const event of Deno.watchFs(this.#scope.normal_pathname, {recursive: true})) {
			if (handling) continue;

			handling = true;
			for (const path of event.paths) {
				this.handleFileUpdate(Path.File(path));
			} 
			this.handleUpdate();
			setTimeout(() => handling = false, 500)
		}
	}

	private async handleFileUpdate(path: Path.File) {
		logger.info("#color(grey)file update: " + path.getAsRelativeFrom(this.scope.parent_dir).replace(/^\.\//, ''));

		// is eternal file, update
		if (path.hasFileExtension(...eternalExts)) {
			await updateEternalFile(path, app.base_url, app.options!.import_map, app.options!);
		}
	}

	public handleUpdate(type: "backend"|"common" = "backend") {
		// backend watch disabled
		if (!this.#watch) return;

		// only log info for developer
		if (this.#watch == "info") logger.warn("A "+type+" file was updated, "+(type=="backend"?"":"backend ")+"restart might be required. Start uix with -b to automatically restart the backend.")
		// restart backend
		else this.restart()
	}

	private restart() {
		logger.info("reloading backend...");
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
			await resolveEntrypointRoute({entrypoint: this.#content_provider}); // load fully
			return this.#content_provider;
		}
		else if (this.#pagesDir) {
			logger.debug(`Using ${this.#pagesDir} as pages for backend entrypoint`)
			this.#content_provider = new PageProvider(this.#pagesDir);
			// default ts export, or just the result if DX and not ts module
			await resolveEntrypointRoute({entrypoint: this.#content_provider}); // load fully
			return this.#content_provider;
		}
		return null;
	}

}