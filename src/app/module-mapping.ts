import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";
import { normalizedAppOptions } from "./options.ts";
import { Path } from "../utils/path.ts";
import { walk } from "https://deno.land/std@0.177.0/fs/walk.ts";
import { getEternalModule } from "./eternal-module-generator.ts";

const eternalExts = [
	'ts',
	'tsx',
	'js',
	'jsx',
	'mts',
	'mjs',
]

export async function createProxyImports(options: normalizedAppOptions, baseURL: URL, denoConfigPath: URL) {
	const proxyImportMapPath = new Path("./importmap.lock.json", cache_path)
	const proxyImportMap = options.import_map.getMoved(proxyImportMapPath, false);

	// add backend, frontend etc
	for (const frontend of options.frontend) {
		proxyImportMap.addEntry(frontend.name+'/', frontend);
	}
	for (const backend of options.backend) {
		proxyImportMap.addEntry(backend.name+'/', backend);
	}
	for (const common of options.common) {
		proxyImportMap.addEntry(common.name+'/', common);
	}

	// add .eternal.ts proxy modules
	const promises = []
	const cachePath = new Path(cache_path);
	for await (const e of walk!(baseURL.pathname, {includeDirs: false, exts: eternalExts.map(x => '.eternal.'+x)})) {
		const path = new Path(e.path);
		if (path.isChildOf(cachePath)) continue;
		promises.push(createEternalProxyFile(new Path(e.path), baseURL));
	}
	for (const [key, val] of (await Promise.all(promises)).flat()) {
		proxyImportMap.addEntry(key, val);
	}

	await proxyImportMap.save();

	await updateDenoConfigImportMap(denoConfigPath, proxyImportMapPath);

	return proxyImportMap;
}

async function updateDenoConfigImportMap(denoConfigPath:URL, proxyImportMapPath:Path) {
	// update import map path in deno.json
	const denoConfig = JSON.parse(await Deno.readTextFile(denoConfigPath));
	let importMapPath: Path|undefined = undefined;
	// create outsourced import map as backup if imports are inline
	if (denoConfig.imports) {
		importMapPath = new Path("./importmap.json", denoConfigPath)
		await Deno.writeTextFile(importMapPath, JSON.stringify({imports: denoConfig.imports}, null, "    "))
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
		await Deno.writeTextFile(denoConfigPath, JSON.stringify(newDenoConfig, null, "    "))
	}
}

async function createEternalProxyFile(path: Path, baseURL: URL): Promise<[Path|string, Path|string][]>{

	const specifier = '_originalEternalModule/' + path.getAsRelativeFrom(baseURL).replace(/^\.\//, '');

	const proxyPath = new Path('./eternal/'+ path.filename, cache_path);
	await Deno.mkdir(proxyPath.parent_dir.pathname, {recursive: true});

	const eternalModule = await getEternalModule(path, specifier);
	await Deno.writeTextFile(proxyPath, eternalModule)

	return [
		[specifier, path],
		[path, proxyPath]
	];
}