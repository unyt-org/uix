import { Logger } from "datex-core-legacy/datex_all.ts";
import { AppPlugin } from "../app/app-plugin.ts";
import { Path } from "https://dev.cdn.unyt.org/unyt_core/utils/path.ts";
import { normalizedAppOptions } from "../app/options.ts";

const logger = new Logger("SQL Storage Plugin");

export default class SQLStoragePlugin implements AppPlugin {
	apply(data: unknown, rootPath: Path<Path.Protocol.File, boolean>, appOptions: normalizedAppOptions): void | Promise<void> {
		console.info(data, rootPath, appOptions)
	}
	name = "git_deploy"

}