import { path, updateRootPath } from "../app/args.ts";
import { logger } from "./global-values.ts";
import { Path } from "./path.ts";

export async function initBaseProject() {

	const gitRepo = "https://github.com/unyt-org/uix-base-project.git"
	const rootPath = new Path(path??'./', 'file://' + Deno.cwd() + '/');

	if (rootPath.getChildPath(".git").fs_exists) {
	  logger.error(`Git repository already exist in this location`);
	  Deno.exit(1);
	}
  
	console.log("Initializing new UIX project");

	const move = rootPath.getChildPath(".datex-cache").fs_exists;
	const tempDir = new Path('file://' + await Deno.makeTempDir() + '/');
	if (move) await Deno.rename(rootPath.getChildPath(".datex-cache"), tempDir.normal_pathname);

	const clone = Deno.run({
	  cmd: ["git", "clone", gitRepo, rootPath.normal_pathname],
	});
	const cloneResult = await clone.status();
  
	if (!cloneResult.success) {
	  throw new Error("Failed to clone.");
	}
	
	if (move)  await Deno.rename(tempDir.normal_pathname, rootPath.getChildPath(".datex-cache"));

	updateRootPath();
}