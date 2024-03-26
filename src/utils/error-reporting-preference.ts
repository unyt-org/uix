import { client_type } from "datex-core-legacy/utils/constants.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";

export async function getErrorReportingPreference() {
	if (client_type !== "deno") return false;

	// TODO: remove
	return true;

	const { allowAll, allowNone, stage } = await import("../app/args.ts" /*lazy*/);

	if (stage !== "dev") return false;

	if (allowAll) return true;
	if (allowNone) return false;

	const allowDiagonisticsFile = getFile()
	return allowDiagonisticsFile.fs_exists && (await allowDiagonisticsFile.getTextContent()).includes("Yes")
}

function getFile() {
	return Deno.env.has("HOME")||Deno.env.has("LOCALAPPDATA") ? new Path("./.unyt-diagonistics", Path.File(Deno.env.get("HOME")??Deno.env.get("LOCALAPPDATA")).asDir()) : new Path<Path.Protocol.File, true>('./uix/.unyt-diagonistics', cache_path);
}

export async function shouldAskForErrorReportingPreference() {
	if (client_type !== "deno") return false;
	const { allowAll, allowNone, stage } = await import("../app/args.ts" /*lazy*/);

	return !getFile().fs_exists && !allowAll && !allowNone;
}

export async function saveErrorReportingPreference(allow: boolean) {
	const file = getFile();
	await Deno.mkdir(file.parent_dir.normal_pathname, {recursive: true});
	await Deno.writeTextFile(file.normal_pathname, allow ? "Yes" : "No");
}
