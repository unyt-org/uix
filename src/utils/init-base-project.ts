import { path, updateRootPath } from "../app/args.ts";
import { isGitInstalled } from "./git.ts";
import { logger } from "./global-values.ts";
import { Path } from "datex-core-legacy/utils/path.ts";

export async function initBaseProject() {

	const gitRepo = "https://github.com/unyt-org/uix-base-project.git"
	const rootPath = new Path(path??'./', 'file://' + Deno.cwd() + '/');

	if (rootPath.getChildPath(".git").fs_exists) {
	  logger.error(`Git repository already exist in this location`);
	  Deno.exit(1);
	}
  
	console.log("Initializing new UIX project");

	const dxCacheDirExists = rootPath.getChildPath(".datex-cache").fs_exists;
	console.log("datex-cache exists: " + dxCacheDirExists);
	// if (dxCacheDirExists) await Deno.remove(rootPath.getChildPath(".datex-cache").normal_pathname, {recursive: true});
	// const tempDir = new Path('file://' + await Deno.makeTempDir() + '/');
	// if (move) {
	// 	try {
	// 		await Deno.rename(rootPath.getChildPath(".datex-cache"), tempDir.normal_pathname);
	// 	}
	// 	catch {
	// 		await Deno.remove(rootPath.getChildPath(".datex-cache"), {recursive: true});
	// 	}
	// }
	if (!isGitInstalled()) {
		logger.error(`Unable to find git executable in PATH. Please install Git before retrying (https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)`);
		Deno.exit(1);
	}
	try {
		const clone = Deno.run({
			cmd: ["git", "clone", gitRepo, rootPath.normal_pathname],
			stdout: "null"
		});
		if (!(await clone.status()).success)
			throw new Error("Git clone failed");
	} catch (error) {
		logger.error(`Unable to clone repository. Please make sure that Git is correctly installed.`, error);
		Deno.exit(1);
	}
	
	// if (move) {
	// 	try {
	// 		await Deno.rename(tempDir.normal_pathname, rootPath.getChildPath(".datex-cache"));
	// 	}
	// 	catch {}
	// }
	await Deno.remove(rootPath.getChildPath(".git"), {recursive: true});

	updateRootPath();
}