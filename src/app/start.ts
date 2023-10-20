import { Datex } from "datex-core-legacy";
import { getAppOptions } from "./config-files.ts";
import { env, rootPath } from "./args.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";
import "./dom-context.ts";
import { app } from "./app.ts";
const logger = new Datex.Logger("UIX App Runner");

if (client_type !== "deno") {
	logger.error("The UIX app runner can only be used on a deno backend");
	throw new Error("Runtime environment error");
}

// inject env variables
for (const envVar of env) {
	const [name, val] = envVar.split("=");
	Deno.env.set(name, val)
}


// get app.dx / app.json
const config = await getAppOptions(rootPath);
app.start(config, rootPath)
