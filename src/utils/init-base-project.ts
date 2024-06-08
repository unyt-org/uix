import { ESCAPE_SEQUENCES } from "datex-core-legacy/datex_all.ts";
import { path, updatePath, updateRootPath } from "../app/args.ts";
import { isGitInstalled } from "./git.ts";
import { logger } from "./global-values.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import process from "node:process";

export async function initBaseProject(name?: string) {

	if (!isGitInstalled()) {
		logger.error(`Unable to find git executable in PATH. Please install Git before retrying (https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)`);
		Deno.exit(1);
	}
	
	const gitRepo = "https://github.com/unyt-org/uix-base-project.git"
	const cwd = new Path(path??'./', 'file://' + Deno.cwd() + '/');
	let projectName: string|undefined = undefined;
	let projectPath: Path;

	if (!name) {
		while (!projectName) {
			projectName = prompt(ESCAPE_SEQUENCES.BOLD+"Enter the name of the new project:"+ESCAPE_SEQUENCES.RESET)!;
		}
		do {
			name = prompt(ESCAPE_SEQUENCES.BOLD+"Enter the name of the project directory:"+ESCAPE_SEQUENCES.RESET, projectName?.toLowerCase().replace(/[^\w]/g, "-") ?? "new-project")!;
			projectPath = cwd.getChildPath(name).asDir();
		}
		while (projectPath.fs_exists && 
			(logger.error(`The directory ${projectPath.normal_pathname} already exists. Please choose a different directory.`), true)
		)
	}
	else {
		projectName = name;
		projectPath = cwd.getChildPath(name).asDir();
		if (projectPath.fs_exists) {
			logger.error(`The directory ${projectPath.normal_pathname} already exists. Please choose a different name.`);
			Deno.exit(1);
		}
	}

	logger.success(`Initializing new UIX project "${projectName}"`);

	const dxCacheDirExists = cwd.getChildPath(".datex-cache").fs_exists;
	if (dxCacheDirExists) {
		await Deno.remove(cwd.getChildPath(".datex-cache"), {recursive: true});
	}

	try {
		const clone = Deno.run({
			cmd: ["git", "clone", gitRepo, projectPath.normal_pathname],
			stdout: "null"
		});
		if (!(await clone.status()).success)
			throw new Error("Git clone failed");
	} catch (error) {
		logger.error(`Unable to clone repository. Please make sure that Git is correctly installed.`, error);
		Deno.exit(1);
	}
	
	await Deno.remove(projectPath.getChildPath(".git"), {recursive: true});

	// update app name in app.dx
	const appDxContent = await Deno.readTextFile(projectPath.getChildPath("app.dx"));
	const newAppDxContent = appDxContent.replace(/name:.*/, `name: "${projectName}",`);
	await Deno.writeTextFile(projectPath.getChildPath("app.dx"), newAppDxContent);

	try {
		await Deno.run({
			cwd: projectPath.normal_pathname,
			cmd: ["git", "init"],
			stdout: "null"
		}).status();
	}
	catch (error) {
		logger.error(`Unable to initialize git repository.`, error);
	}

	updatePath(projectPath.normal_pathname);
	await updateRootPath();
}