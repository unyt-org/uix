import { normalized_app_options } from "./app.ts";
import {Path} from "unyt_node/path.ts";

export class BackendManager {
	
	#path: URL

	constructor(app_options:normalized_app_options, path:URL, base_path:URL){
		this.#path = path;
	}

	async run() {
		// start entrypoint if it exists
		const entrypoint = new Path('./entrypoint.ts', this.#path);
		if (entrypoint.fs_exists) {
			await import(entrypoint.toString());
		} 

	}

}