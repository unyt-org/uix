import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";
import { normalizedAppOptions } from "./options.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { walk } from "https://deno.land/std@0.177.0/fs/walk.ts";
import { getEternalModule } from "./eternal-module-generator.ts";
import type { ImportMap } from "../utils/importmap.ts";

export const eternalExts = [
	'ts',
	'tsx',
	'js',
	'jsx',
	'mts',
	'mjs',
].map(x => 'eternal.'+x);

export async function createProxyImports(options: normalizedAppOptions, baseURL: URL, denoConfigPath: URL) {
	console.log(cache_path,"<<<")
	const proxyImportMapPath = new Path("./importmap.lock.json", cache_path)
	const proxyImportMap = options.import_map.getMoved(proxyImportMapPath, false);

	// add backend, frontend etc
	const dirs = [...options.frontend, ...options.backend, ...options.common]

	for (const dir of dirs) {
		proxyImportMap.addEntry(dir.name+'/', dir);
	}

	// block frontend paths from common + backend modules
	for (const frontendDir of options.frontend) {
		for (const dir of options.backend)	{
			proxyImportMap.addEntry(frontendDir, "", true, dir);
		}
		for (const dir of options.common)	{
			proxyImportMap.addEntry(frontendDir, "", true, dir);
		}
	}
	
	// add .eternal.ts proxy modules
	
	for await (const e of walk!(new Path(baseURL).normal_pathname, {includeDirs: false, exts: eternalExts.map(e => "."+e)})) {
		const path = Path.File(e.path);

		if (path.isChildOf(cache_path)) continue;
		const proxyPath = await createEternalProxyFile(path, baseURL);
		addEternalFileImportMapScope(path, proxyPath, proxyImportMap, options);
	}

	await proxyImportMap.save();

	await updateDenoConfigImportMap(denoConfigPath, proxyImportMapPath);

	return proxyImportMap;
}


async function updateDenoConfigImportMap(denoConfigPath:URL, proxyImportMapPath:Path) {
	// update import map path in deno.json
	const denoConfig = JSON.parse(await Deno.readTextFile(new Path(denoConfigPath).normal_pathname));
	let importMapPath: Path|undefined = undefined;
	// create outsourced import map as backup if imports are inline
	if (denoConfig.imports) {
		importMapPath = new Path("./importmap.json", denoConfigPath)
		await Deno.writeTextFile(importMapPath.normal_pathname, JSON.stringify({imports: denoConfig.imports}, null, "    "))
	}
	else if (denoConfig._publicImportMap || denoConfig.importMap) {
		importMapPath = new Path(denoConfig._publicImportMap || denoConfig.importMap, denoConfigPath);
	}

	if (importMapPath) {
		const newDenoConfig = {
			_publicImportMap: importMapPath.getAsRelativeFrom(denoConfigPath),
			importMap: proxyImportMapPath.getAsRelativeFrom(denoConfigPath),
			compilerOptions: denoConfig.compilerOptions
		}
		await Deno.writeTextFile(new Path(denoConfigPath).normal_pathname, JSON.stringify(newDenoConfig, null, "    "))
	}
}

/**
 * Updates the importmap.lock entries and the proxy files for an eternal module
 * @param src_path 
 * @param baseURL 
 * @param importMap 
 */
export async function updateEternalFile(path: Path.File, baseURL: URL, importMap: ImportMap, options: normalizedAppOptions) {
	if (path.fs_exists) {
		const proxyPath = await createEternalProxyFile(path, baseURL);
		addEternalFileImportMapScope(path, proxyPath, importMap, options);
	}
	else {
		await deleteEternalProxyFile(path, baseURL);
		importMap.removeEntry(path, true, "*");
	}
}

function addEternalFileImportMapScope(path:Path, proxyPath: Path, importMap: ImportMap, options: normalizedAppOptions) {
	
	let isFrontendPath = false;
	for (const dir of options.frontend) {
		if (path.isChildOf(dir)) isFrontendPath = true;
	}

	// add to frontend imports
	for (const dir of options.frontend)	{
		importMap.addEntry(path, proxyPath, true, dir);
	}
	// add to common/backend only if not frontend
	if (!isFrontendPath) {
		for (const dir of options.backend)	{
			importMap.addEntry(path, proxyPath, true, dir);
		}
		for (const dir of options.common)	{
			importMap.addEntry(path, proxyPath, true, dir);
		}
	}
}

/**
 * Creates a new eternal module proxy file and returns the import map specifiers
 * @param path 
 * @param baseURL 
 * @returns 
 */
async function createEternalProxyFile(path: Path.File, baseURL: URL): Promise<Path>{
	const { relPath, proxyPath } = getEternalMapPaths(path, baseURL)

	await Deno.mkdir(proxyPath.parent_dir.normal_pathname, {recursive: true});

	const eternalModule = await getEternalModule(path, relPath);
	await Deno.writeTextFile(proxyPath, eternalModule)

	return proxyPath
}

/**
 * Deletes an eternal module proxy file and returns the import map specifiers
 * @param path 
 * @param baseURL 
 * @returns 
 */
async function deleteEternalProxyFile(path: Path.File, baseURL: URL) {
	const { relPath, proxyPath } = getEternalMapPaths(path, baseURL)
	
	await Deno.remove(proxyPath, {recursive: true});
	return relPath;
}


function getEternalMapPaths(path: Path.File, baseURL: URL) {
	const relPath = path.getAsRelativeFrom(baseURL).replace(/^\.\//, '').replaceAll("\\", "/");
	const proxyPath = new Path('./eternal/'+ relPath, cache_path) as Path<Path.Protocol.File>;
	return {
		relPath,
		proxyPath
	}
}


/**
 * Returns the proxy path for a given eternal module path
 * (this path is used when deno is running)
 * @param path eternal module path
 * @param baseURL app base url
 * @returns 
 */
export function getEternalModuleProxyPath(path: Path.File, baseURL: Path.File) {
	return getEternalMapPaths(path, baseURL).proxyPath
}