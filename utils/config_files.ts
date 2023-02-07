// no explicit imports, should also work without import maps...

/**
 * get combined config of app.dx and deno.json
 */
export async function getAppConfig(root_path:URL): Promise<Record<string, unknown>> {
	const config_path = await getExistingFile(root_path, './app.dx', './app.json');
	let config = {}
	
	if (config_path) {
		const raw_config = await datex.get(config_path);
		if (typeof raw_config != "object" || !raw_config) {
			throw "Invalid config file"
		}
		config = Object.fromEntries(Datex.DatexObject.entries(<Record<string, unknown>>raw_config));
	}
	// else throw "Could not find an app.dx or app.json config file in the root directory " + root_path

	// set import map from deno.json if exists
	const deno_path = await getExistingFile(root_path, './deno.json');
	if (!config.import_map_path && !config.import_map && deno_path) {
		try {
			const deno = JSON.parse(await Deno.readTextFile(deno_path));
			
			// imports
			if (deno.imports) {
				config.import_map = {imports:deno.imports};
			}
			// importMap path
			else if (deno.importMap) {
				config.import_map_path = new URL(deno.importMap, root_path);
			}
		} catch {}
	} 

	return config
}

export async function getExistingFile(root_path:URL, ...paths:(string|URL)[]):Promise<string|URL|null> {
	try {
		const path = paths.shift();
		if (!path) return null;
		const abs_path = new URL(path, root_path);
		await Deno.open(abs_path)
		return abs_path;
	}
	catch {
		return paths.length ? getExistingFile(root_path, ...paths) : null;
	}
}