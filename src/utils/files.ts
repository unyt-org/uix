/**
 * Checks if a file exists, querying the (cached)
 * directory index file. Returns true if no directory
 * index was found
 */

import { Path } from "datex-core-legacy/utils/path.ts";

const directoryIndexFiles = new Map<string, object>();

// Results for web URLs with cached=true. Directory indexes are already cached for the
// lifetime of the module, so the answer for a URL cannot change; this avoids repeating
// Path/URL construction and index traversal for every component instance.
const webExistsCache = new Map<string, Promise<boolean|undefined>>();

export function fileExists(url: URL|string, options: {cached?: boolean, fallbackRequest?: boolean} = {cached: true, fallbackRequest: true}): Promise<boolean|undefined> {
	if (!options.cached) return fileExistsUncached(url, options);
	const key = (options.fallbackRequest ? "1" : "0") + url.toString();
	let result = webExistsCache.get(key);
	if (!result) {
		result = fileExistsUncached(url, options);
		const urlPath = url instanceof Path ? url : new Path(url);
		if (urlPath.is_web) webExistsCache.set(key, result);
	}
	return result;
}

async function fileExistsUncached(url: URL|string, {cached, fallbackRequest}: {cached?: boolean, fallbackRequest?: boolean}) {
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