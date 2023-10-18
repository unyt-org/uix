import { Datex,f } from "datex-core-legacy";
import home_dir from "https://deno.land/x/dir@1.5.1/home_dir/mod.ts";
import { Path } from "../utils/path.ts";

const logger = new Datex.Logger("Developer Login", true)
export async function triggerLogin() {
	logger.info("Connect your personal endpoint")
	const endpointName = prompt("Please enter your endpoint identifier:")!;
	const endpoint = f(endpointName);
	const homeDirectory = home_dir();
	const uixHomeDir = new Path(".uix/", 'file://'+homeDirectory+'/')
	if (!uixHomeDir.fs_exists) await Deno.mkdir(uixHomeDir, {recursive:true});

	const config = {
		endpoint
	};

	const serialized = Datex.Runtime.valueToDatexString(new Datex.Tuple(config));
	await Deno.writeTextFile(uixHomeDir.getChildPath(".dx").normal_pathname, serialized)

}