import { ESCAPE_SEQUENCES } from "datex-core-legacy/utils/logger.ts";
import { Path } from "./src/utils/path.ts";

export async function handleAutoUpdate(baseLibPath: Path, name: string) {
	const { renderMarkdown } = await import('https://deno.land/x/charmd/mod.ts');

	baseLibPath = baseLibPath.asDir()
	// console.log("Finding updates for " + name + " (" + baseLibPath + ")")
	const currentCachedVersion = (await import(baseLibPath.getChildPath("./VERSION.ts").toString())).default;
	const currentVersion = (await baseLibPath.getChildPath("VERSION").getTextContent()).replaceAll("\n","")
	// TODO: check if current version higher?
	if (currentCachedVersion !== currentVersion) {
		let changelog = "";
		try {
			changelog = (await baseLibPath.getChildPath("CHANGELOG.md").getTextContent())
		}
		catch {
			changelog = "Not available";
		}
		console.log(`\n${ESCAPE_SEQUENCES.BOLD}New ${name} release:${ESCAPE_SEQUENCES.RESET} ${currentCachedVersion} -> ${ESCAPE_SEQUENCES.UNYT_GREEN}${currentVersion}${ESCAPE_SEQUENCES.RESET}`)
		console.log(`${ESCAPE_SEQUENCES.BOLD}Changelog:\n${ESCAPE_SEQUENCES.RESET}${renderMarkdown(changelog)}\n`)
		alert("Update");
		return true;
	}
	return false;
}

export async function updateCache(module: URL|string) {
	const denoLock = Path.File(Deno.cwd()).asDir().getChildPath("deno.lock");
	if (denoLock.fs_exists) {
		await Deno.remove(denoLock.normal_pathname)
	}

	console.log("-> updating " + module)
	const cacheReloadCommand = new Deno.Command(Deno.execPath(), {
		args: [
			"cache",
			"--reload",
			module.toString()
		]
	});
	await cacheReloadCommand.output()
}