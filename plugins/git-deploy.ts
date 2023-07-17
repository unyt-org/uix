import { AppPlugin } from "../utils/config_files.ts";
declare const Datex: any; // cannot import Datex here, circular dependency problems

export class GitDeployPlugin implements AppPlugin {
	name = "git_deploy"

	apply(data: Record<string, unknown>) {
		data = Object.fromEntries(Datex.DatexObject.entries(data));

		console.log("apply git deploy", data)
	}
}