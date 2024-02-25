import { Path } from "datex-core-legacy/utils/path.ts";

const importRegex = /(?<=(?:^|;)(?: *\*\/ *)?)((?:import|export)\s*(?:(?:[A-Za-z0-9_$,{}* ]|["'](?:[^"']+)["'])*)\s*from\s*|import\s*)["']([^"']+)["']|(?:import|datex\.get)\s*\((?:"([^"]*)"|'([^']*)')\)/gm;
const importTypeRegex = /(import|export) type.*/;

const cachedDependencies = new Map<string, Set<string>>();
const trees = new Map<string, string[][]>();

export async function resolveDependencies(file: Path|string, tree:string[] = []) {
	if (typeof file === 'string') file = new Path(file);
	const paths = new Set<string>();

	const exists = trees.has(file.toString());

	if (!trees.has(file.toString())) trees.set(file.toString(), []);
	trees.get(file.toString())!.push([...tree]);

	// cached
	if (cachedDependencies.has(file.toString())) return cachedDependencies.get(file.toString())!;

	// don't recurse if we've already seen this file
	// if (allPaths.has(file.toString())) return paths;
	if (exists) return paths;

	tree.push(file.toString());

	try {
		const content = await file.getTextContent()
		const imports = content.matchAll(importRegex)
		const promises = [];


		for (const [_, pre, path1, path2, path3] of imports) {
			const path = path1 ?? path2 ?? path3;
			if (pre?.match(importTypeRegex) || path.endsWith("#lazy") || path.startsWith("https://deno.land/") || path.startsWith("npm:")) {
				// console.log("skipped lazy import: " + path)
				continue;
			}
			const normalizedPath = path.startsWith('./') || path.startsWith('../') ? new Path(path, file).toString() : path;
			const resolvedPath = import.meta.resolve(normalizedPath);

			promises.push(resolveDependencies(resolvedPath, [...tree]));
			// console.log("   + " + resolvedPath)
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
	// i/o error might occur if the path is invalid
	catch (e) {
		console.error(file.toString()+":", e)
		cachedDependencies.set(file.toString(), paths);
		return paths;
	}
}