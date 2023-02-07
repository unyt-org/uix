import { normalized_app_options } from "./app.ts";

export class BackendManager {
	
	#path: URL

	constructor(app_options:normalized_app_options, path:URL, base_path:URL){
		this.#path = path;
	}

	async run() {
		// start entrypoint if it exists
		const entrypoint = new URL('./entrypoint.ts', this.#path);
		try {
			await Deno.stat(entrypoint)
			await import(entrypoint.toString());
		} 
		catch {}
	}

}