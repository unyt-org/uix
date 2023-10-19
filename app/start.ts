import {Datex} from "unyt_core";
import {UIX} from "uix";
import { getAppOptions } from "./config-files.ts";
import { env, rootPath } from "./args.ts";
import { client_type } from "unyt_core/utils/constants.ts";
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
UIX.app.start(config, rootPath)