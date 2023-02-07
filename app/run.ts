import {Datex} from "unyt_core";
import {UIX} from "uix";
import { getAppConfig } from "../utils/config_files.ts";
const logger = new Datex.Logger("UIX App Runner");

if (!globalThis.Deno) {
	logger.error("The UIX app runner can only be used on a deno backend");
	throw new Error("Runtime environment error");
}

// command line args (--path)
const flags = (await import("https://deno.land/std@0.168.0/flags/mod.ts")).parse(Deno.args, {
	string: ["path"],
	alias: {
		p: "path"
	}
});

const root_path = new URL(flags["path"]??'./', 'file://' + Deno.cwd() + '/');

// get app.dx / app.json
const config = await getAppConfig(root_path);
UIX.App.start(config, root_path)