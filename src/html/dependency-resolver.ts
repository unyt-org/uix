import { Path } from "datex-core-legacy/utils/path.ts";
import { getDirType } from "../app/utils.ts";
import { normalizedAppOptions } from "../app/options.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";

const importRegex = /(?<=(?:^|;)(?: *\*\/ *)?)((?:import|export)\s*(?:(?:[A-Za-z0-9_$,{}* ]|["'](?:[^"']+)["'])*)\s*from\s*|import\s*)["']([^"']+)["']|(?:import|datex\.get)\s*\((?:"([^"]*)"|'([^']*)')\)/gm;
const importTypeRegex = /(import|export) type.*/;

const cachedDependencies = new Map<string, Set<string>>();
const dependencyPaths = new Map<string, string[][]>();

const resolvingPromises = new Set<Promise<void>>()

export async function resolveDependencies(file: Path|string, appOptions: normalizedAppOptions, tree:string[] = [], isRoot = true) {
	const { FrontendManager } = client_type == "deno" ? await import("../app/frontend-manager.ts") : {FrontendManager:null};	
	
	if (typeof file === 'string') file = new Path(file);

	const exists = dependencyPaths.has(file.toString());

	if (!dependencyPaths.has(file.toString())) dependencyPaths.set(file.toString(), []);
	dependencyPaths.get(file.toString())!.push([...tree]);

	// cached
	if (cachedDependencies.has(file.toString())) return cachedDependencies.get(file.toString())!;

	// don't recurse if we've already seen this file
	if (exists) return new Set<string>();

	tree.push(file.toString());

	const {promise, resolve} = Promise.withResolvers<void>()
	if (isRoot) resolvingPromises.add(promise)

	try {
		if (file.isWeb()) {
			const response = await fetch(file.toString());
			// has X-Module-Dependencies header
			if (response.headers.get("X-Module-Dependencies") == "true") {
				console.log(file + " has x-module-dependencies header")
				return await resolveDependenciesFromDependencyFile(file);
			}
			// http file without X-Module-Dependencies header
			else return await resolveDependenciesFromSource(file, await response.text(), appOptions, tree, FrontendManager);
		}
		// normal file
		else return await resolveDependenciesFromSource(file, undefined, appOptions, tree, FrontendManager);
	}
	// i/o error might occur if the path is invalid
	catch {
		const paths = new Set<string>();
		cachedDependencies.set(file.toString(), paths);
		return paths;
	}
	finally {
		if (isRoot) {
			resolve()
			resolvingPromises.delete(promise);
		}
	}
}

async function resolveDependenciesFromDependencyFile(file: Path) {
	const depsTree = await (await fetch(file.getWithFileExtension(file.ext + '.dependencies'))).json()

	const allDeps = new Set<string>();
	resolveFileMap(depsTree, allDeps, file);

	return allDeps;
}

function resolveFileMap(tree: Exclude<Tree, null>, allDeps: Set<string>, rootPath: Path) {
	const topLevelDeps = new Set<string>();
	for (const [key, value] of Object.entries(tree)) {
		const keyFile = Path.pathIsURL(key) ? 
			key :
			key.startsWith('./') || key.startsWith('../') ?
				new Path(key, rootPath):
				import.meta.resolve(key);
		
		topLevelDeps.add(keyFile.toString());
		allDeps.add(keyFile.toString());
		if (value) {
			const deps = resolveFileMap(value, allDeps, rootPath);
			cachedDependencies.set(keyFile.toString(), deps);
		}
	}
	return topLevelDeps;
}



async function resolveDependenciesFromSource(file: Path, source:string|undefined, appOptions: normalizedAppOptions, tree: string[] = [], FrontendManager: any) {
	const content = source ?? await file.getTextContent()
	const imports = content.matchAll(importRegex)
	const promises = [];
	const paths = new Set<string>();

	for (const [_, pre, path1, path2, path3] of imports) {
		const path = path1 ?? path2 ?? path3;
		if (pre?.match(importTypeRegex) || path.startsWith("https://deno.land/") || path.startsWith("npm:")) {
			continue;
		}
		const normalizedPath = path.startsWith('./') || path.startsWith('../') ? new Path(path, file).toString() : path;
		const resolvedPath = import.meta.resolve(normalizedPath);

		// ignore backend modules that are not exposed to the frontend
		const resolvedPathObj = new Path(resolvedPath);
		if (!resolvedPathObj.isWeb() && getDirType(appOptions, resolvedPathObj as Path.File) === 'backend' && !FrontendManager?.exposedBackendPaths.has(resolvedPath)) {
			continue;
		}

		promises.push(resolveDependencies(resolvedPathObj, appOptions, [...tree], false));
		paths.add(resolvedPath);
	}
	for (const childPaths of await Promise.all(promises)) {
		for (const childPath of childPaths) {
			paths.add(childPath);
		}
	}

	cachedDependencies.set(file.toString(), paths);
	return paths;
}


type Tree = {[key:string]:Tree} | null;

/**
 * Custom prefix mappings
 * Full file path -> custom prefix
 * e.g. "file://libs/datex-core-legacy/*" -> "datex-core-legacy/*"
 */
export const prefixMappings = new Map<string,string>()

/**
 * Returns a list of dependencies for a given file, if available
 * @param file
 * @returns 
 */
export function getDependencyTree(file: Path|string, visitedNodes:Set<string> = new Set(), root = new Path(file)): Tree {
	file = file.toString();
	visitedNodes.add(file);

	if (!cachedDependencies.has(file)) return null

	return Object.fromEntries([...cachedDependencies.get(file)!].map(p => {
		let pKey = p;
		// prefix replacements
		for (const [prefix, replacement] of prefixMappings) {
			if (pKey.startsWith(prefix)) {
				pKey = replacement + pKey.slice(prefix.length);
				break;
			}
		}
		pKey = pKey.startsWith('file://') ? new Path(pKey).getAsRelativeFrom(root).toString() : pKey;

		if (visitedNodes.has(p)) return [pKey, null];
		return [pKey, getDependencyTree(p, visitedNodes, root)];
	}));
}

/**
 * Returns a list of dependencies for a given file
 * Loads the dependencies if they are not already cached
 * @param file 
 * @param appOptions 
 * @returns 
 */
export async function loadDependencyList(file: Path|string, appOptions: normalizedAppOptions) {
	await resolveDependencies(file, appOptions);
	await Promise.all(resolvingPromises) // make sure all currently blocking dependency resolvers are done
	return getDependencyTree(file);
}

export function hasDependencyList(file: Path|string) {
	return cachedDependencies.has(file.toString());
}
