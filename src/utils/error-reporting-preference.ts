import { client_type } from "datex-core-legacy/utils/constants.ts";
import { allowAll, allowNone, stage } from "../app/args.ts";
import { Path } from "./path.ts";
import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";

export async function getErrorReportingPreference() {
	if (client_type !== "deno") return false;
	if (stage !== "dev") return false;

	if (allowAll) return true;
	if (allowNone) return false;

	const allowDiagonisticsFile = getFile()
	return allowDiagonisticsFile.fs_exists && (await allowDiagonisticsFile.getTextContent()).includes("Yes")
}

function getFile() {
	return Deno.env.has("HOME")||Deno.env.has("LOCALAPPDATA") ? new Path("./.unyt-diagonistics", Path.File(Deno.env.get("HOME")??Deno.env.get("LOCALAPPDATA")).asDir()) : new Path<Path.Protocol.File, true>('./uix/.unyt-diagonistics', cache_path);
}

export function shouldAskForErrorReportingPreference() {
	return !getFile().fs_exists && !allowAll && !allowNone;
}

export async function saveErrorReportingPreference(allow: boolean) {
	const file = getFile();
	await Deno.mkdir(file.parent_dir.normal_pathname, {recursive: true});
	await Deno.writeTextFile(file.normal_pathname, allow ? "Yes" : "No");
}
