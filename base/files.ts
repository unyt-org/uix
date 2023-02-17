/** FILE STUFF */

import { Types } from "../utils/global_types.ts";
import { I } from "../uix_short.ts";
import { Snippets } from "./snippets.ts";
import { Actions } from "./actions.ts";
import { Resource } from "../utils/resources.ts";
import { logger } from "../uix_all.ts";
import { std_lib_files } from "./std_loader.ts";
import { Components } from "../components/main.ts";

export namespace Files {


	// list of file extensions and components that can handle them
	const file_handler_components = {
		"png": "imagefileeditor",
		"svg": "imagefileeditor",
		"jpg": "imagefileeditor",
		"pdf": "pdffileeditor",
		"m4a": "audiofileeditor",
	}

	/** Handle files + file extensions*/

	type file_extension_list = {[extension:string]:{icon?:string, color?:string}}
	export type files = {default_icon?:string, file_extensions?:string[], file_extensions_with_options?:file_extension_list}

	const file_handlers = new Map<string, Set<Types.ComponentSubClass>>();
	export const file_icons = new Map<string, string>();

	export function registerFileHandlerElement(file_extension_list:files, editor: Types.ComponentSubClass) {

		let default_icon = I(file_extension_list.default_icon);
		for (let ext of file_extension_list.file_extensions??[]) {
			ext = ext.replace(/\./g,'');
			if (!file_handlers.has(ext)) file_handlers.set(ext, new Set());
			file_handlers.get(ext).add(editor);
			if (file_extension_list.default_icon) file_icons.set(ext, default_icon);
		}

		for (let [ext, options] of Object.entries(file_extension_list.file_extensions_with_options??[])) {
			ext = ext.replace(/\./g,'');
			if (!file_handlers.has(ext)) file_handlers.set(ext, new Set());
			file_handlers.get(ext).add(editor);

			if (options.icon) file_icons.set(ext, I(options.icon, options.color));
		}
	}




	export function downloadFile(content:string, type = 'text/plain', filename = 'unknown.txt') {
		const fakeLink = document.createElement('a');
		fakeLink.style.display = 'none';
		document.body.appendChild(fakeLink);
		const blob = new Blob([content], { type: type });
		// @ts-ignore
		if (window.navigator && window.navigator.msSaveOrOpenBlob) {
			// Manage IE11+ & Edge
			// @ts-ignore
			window.navigator.msSaveOrOpenBlob(blob, filename);
		} else {
			fakeLink.setAttribute('href', URL.createObjectURL(blob));
			fakeLink.setAttribute('download', filename);
			fakeLink.click();
		}
	};


	export function formatFileName(file_name: string) {
		if (file_name.includes(".") && !file_name.startsWith(".")) {
			let ext = file_name.substring(file_name.lastIndexOf('.'));
			let name = file_name.replace(ext, "")
			return `<span>${name}</span><span style="opacity:0.6">${ext}</span>`
		}
		else return `<span>${file_name}</span>`;
	}




	export async function createFileElement(resource_or_path:string|Resource, constraints:Types.component_constraints):Promise<Components.Base> {

		const resource = resource_or_path instanceof Resource ? resource_or_path : Resource.get(resource_or_path);

		// try load element that can open this file type
		if (!file_handlers.has(resource.extension)) {
			if (file_handler_components[resource.extension]) {
				logger.success("Loading element " + file_handler_components[resource.extension] + " to handle extension '." + resource.extension+"'")
				await import(new URL("../uix_std/"+std_lib_files[file_handler_components[resource.extension]]+"/main.ts", import.meta.url).toString());
			}
		}

		if (file_handlers.has(resource.extension)) {
			let possible_editors = file_handlers.get(resource.extension);
			if (possible_editors.size>1) {
				return new Promise(resolve=>{
					let body = document.createElement("div");
					let cancelDialog;
					for (let editor of possible_editors){
						let item = Snippets.ListItem((editor.DEFAULT_OPTIONS.title||editor.name).toString(), editor.DEFAULT_OPTIONS.icon.toString());
						body.append(item);
						item.addEventListener("click", ()=>{
							cancelDialog();
							resolve(new (<any>editor)({path: resource.path}, constraints))
						})
					}
					cancelDialog = Actions.dialog("Open File '"+ formatFileName(resource.name)+"' with", body).cancel;
				})

			}
			else {
				let editor = [...possible_editors][0];
				if (editor) return new (<any>editor)({path: resource.path}, constraints);
			}
		}


		return null;
	}
}

