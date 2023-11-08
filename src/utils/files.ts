/**
 * Checks if a file exists, querying the (cached)
 * directory index file. Returns true if no directory
 * index was found
 */

import { Path } from "./path.ts";

const directoryIndexFiles = new Map<string, object>();

export async function fileExists(url: URL|string, {cached, fallbackRequest}: {cached?: boolean, fallbackRequest?: boolean} = {cached: true, fallbackRequest: true}) {
	const urlPath = url instanceof Path ? url : new Path(url);

	if (!urlPath.is_web) {
		const existsDefault = urlPath.fs_exists;
		// normal file exists
		if (existsDefault) return true;
		// original (untranspiled) file exists
		else {
			if (urlPath.ext == "css") return urlPath.getWithFileExtension("scss").fs_exists
			if (urlPath.ext == "js" || urlPath.ext == "jsx") return urlPath.getWithFileExtension("ts").fs_exists || urlPath.getWithFileExtension("tsx").fs_exists
		}
	}

	let parent = urlPath.parent_dir;
	const treeNames = [urlPath.name];
	while ((!directoryIndexFiles.has(parent.toString()) || !cached) && parent.pathname) {
		if (parent.parent_dir.pathname == "/" || parent.parent_dir.pathname == "/@uix/src/") break;
		treeNames.push(parent.name)
		parent = parent.parent_dir;
	}

	try {
		let fileTree:any;
		// get index file from cache
		if (cached && directoryIndexFiles.has(parent.toString())) fileTree = directoryIndexFiles.get(parent.toString())
		// fetch index file
		else {
			const indexResponse = await fetch(parent)
			if (!indexResponse.ok) throw "error";
			// save in cache
			fileTree = await indexResponse.json();
			directoryIndexFiles.set(parent.toString(), fileTree);
		}

		let name;
		let subTree = fileTree;

		while ((name = treeNames.pop())) {
			// find subdirectory
			for (const entry of subTree) {
				if (treeNames.length == 0 && typeof entry == "string") {
					if (entry === name) return true; // cannot go deeper, but matches
					else {
						if (entry === name.replace(/\.css$/, '.scss')) return true;
						if (entry === name.replace(/\.jsx?$/, '.ts')) return true;
						if (entry === name.replace(/\.jsx?$/, '.tsx')) return true;
					}
				}
				if (entry.name == name) {
					if (treeNames.length == 0) return true; // cannot go deeper, but matches
					subTree = entry.children;
					break;
				}
			}
		}

		// when this point is reached, the file does not exist
		return false;
	}
	catch {
		if (fallbackRequest) {
			try {
				return (await fetch(url)).ok
			}
			catch (e) {
				return false;
			}
		}
	}

	//  fetch(path)).ok
	return true;
}