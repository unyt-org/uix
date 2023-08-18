import {Datex} from "unyt_core";
import {UIX} from "uix";
import { getAppOptions } from "./config-files.ts";
import { env, root_path } from "./args.ts";
const logger = new Datex.Logger("UIX App Runner");

if (!globalThis.Deno) {
	logger.error("The UIX app runner can only be used on a deno backend");
	throw new Error("Runtime environment error");
}

// inject env variables
for (const envVar of env) {
	const [name, val] = envVar.split("=");
	Deno.env.set(name, val)
}


// get app.dx / app.json
const config = await getAppOptions(root_path);
UIX.app.start(config, root_path)