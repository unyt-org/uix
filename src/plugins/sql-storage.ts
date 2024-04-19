import { Logger } from "datex-core-legacy/utils/logger.ts";
import { AppPlugin } from "../app/app-plugin.ts";
import { Path } from "https://dev.cdn.unyt.org/unyt_core/utils/path.ts";
import { normalizedAppOptions } from "../app/options.ts";
import { Datex } from "datex-core-legacy/mod.ts";

const logger = new Logger("SQL Storage Plugin");

export default class SQLStoragePlugin implements AppPlugin {
	async apply(data: any, rootPath: Path<Path.Protocol.File, boolean>, appOptions: normalizedAppOptions): Promise<void> {
		data = Object.fromEntries(Datex.DatexObject.entries(data));
		for (const [stage, _config] of Object.entries(data)) {
			const config =  Object.fromEntries(Datex.DatexObject.entries(data[stage]));
			const hostname = config.hostname ?? "database";
			const port = config.port ?? 3337;
			if (!config.username)
				throw new Error("Username is not defined");
			const username = config.username;
			if (!config.password)
				throw new Error("Password is not defined");
			const password = config.password;
			if (!config.database)
				throw new Error("Database is not defined");
			const database = config.database;
			logger.warn("",
				stage, hostname, port, username, password, database
			);
		}
		await sleep(10_000)
	}
	name = "sql_storage"

}