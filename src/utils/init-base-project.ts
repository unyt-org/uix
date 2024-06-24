import { ESCAPE_SEQUENCES, LOG_FORMATTING } from "datex-core-legacy/datex_all.ts";
import { path, updatePath, updateRootPath } from "../app/args.ts";
import { isGitInstalled } from "./git.ts";
import { logger } from "./global-values.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { handleError } from "./handle-issue.ts";
import { KnownError } from "../app/errors.ts"

export async function initBaseProject(name?: string) {

	if (!isGitInstalled()) {
		handleError(
			new KnownError(
				"Git is required to initialize a new project. However, UIX is not able to execute it.",
				"Make sure that Git is installed on your computer (https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)",
				"Ensure that the 'git' executable is in your PATH environment variable",
				"Verify the correctness of your Git installation"
			),
			logger
		);
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
		if (projectPath.fs_exists)
			handleError(`The directory ${projectPath.normal_pathname} exists already. Please choose a different name.`, logger);
	}

	logger.success(`Initializing new UIX project "${projectName}"`);

	const dxCacheDirExists = cwd.getChildPath(".datex-cache").fs_exists;
	if (dxCacheDirExists) {
		await Deno.remove(cwd.getChildPath(".datex-cache"), {recursive: true});
	}

	try {
		const cloneProcess = new Deno.Command("git", {
			args: ["clone", "--depth=1", "--branch=main", gitRepo, projectPath.normal_pathname],
		});
		const { success, stderr } = await cloneProcess.output();
		if (!success) {
			logger.error("Git reported an error:\n" + new TextDecoder().decode(stderr));
			handleError(
				new KnownError(
					"Could not clone the base project repository.",
					"Check your internet connection",
					`Try to clone it manually (${gitRepo})`
				),
				logger
			);
		}
	} catch (error) {
		handleError(error, logger);
	}
	
	await Deno.remove(projectPath.getChildPath(".git"), {recursive: true});

	// update app name in app.dx
	const appDxContent = await Deno.readTextFile(projectPath.getChildPath("app.dx"));
	const newAppDxContent = appDxContent.replace(/name:.*/, `name: "${projectName}",`);
	await Deno.writeTextFile(projectPath.getChildPath("app.dx"), newAppDxContent);

	try {
		const initProcess = new Deno.Command("git", {
			args: ["init"],
			cwd: projectPath.normal_pathname,
		});

		const { success, stderr } = await initProcess.output();
		if (!success) {
			logger.error("Git reported an error:\n" + new TextDecoder().decode(stderr));
			handleError(
				new KnownError(
					"The base project cannot be initialized using 'git init'.",
					"Try to initialize it manually"
				),
				logger
			);
		}
	}
	catch (error) {
		handleError(error, logger);
	}

	updatePath(projectPath.normal_pathname);
	await updateRootPath();
}