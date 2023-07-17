import {Datex} from "unyt_core";
import {UIX} from "uix";
import { getAppOptions } from "../utils/config_files.ts";
import { root_path } from "../utils/args.ts";
const logger = new Datex.Logger("UIX App Runner");

if (!globalThis.Deno) {
	logger.error("The UIX app runner can only be used on a deno backend");
	throw new Error("Runtime environment error");
}

// get app.dx / app.json
const config = await getAppOptions(root_path);
UIX.App.start(config, root_path)