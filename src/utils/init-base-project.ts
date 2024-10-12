import { ESCAPE_SEQUENCES } from "datex-core-legacy/datex_all.ts";
import { path, updatePath, updateRootPath } from "../app/args.ts";
import { isGitInstalled } from "./git.ts";
import { logger } from "./global-values.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { KnownError, handleError } from "datex-core-legacy/utils/error-handling.ts";

type Repo = {
	repo: string,
	url: string
}
const fallbackTemplateRepoList: Record<string, Repo> = {
	"hello-uix": {
		repo: "uix-template-hello-uix",
		url: "https://github.com/unyt-org/uix-template-hello-uix.git"
	}
} as const;

async function loadTemplates(): Promise<Record<string, Repo>> {
	const prefix = "uix-template-";
	const list = (await datex.get<{items: {
		name: string,
		clone_url: string
	}[]}>(`https://api.github.com/search/repositories?q=${prefix}+in:name+org:unyt-org`)).items;
	if (list && list.length)
		return Object.fromEntries(
			list.map(({name, clone_url}) => [name.replace(prefix, ''), {
				repo: name,
				url: clone_url
			} as Repo])
		);
	else {
		handleError(
			new KnownError(
				"No template repositories found.",
				[
					"Please report this error to https://github.com/unyt-org/uix"
				]
			),
			logger
		);
		return {};
	}
}

export async function initBaseProject(name?: string, template: string = "hello-uix") {
	template = template.toLowerCase();

	if (!isGitInstalled()) {
		handleError(
			new KnownError(
				"Git is required to initialize a new project. However, UIX is not able to execute it.",
				[
					"Make sure that Git is installed on your computer (https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)",
					"Ensure that the 'git' executable is in your PATH environment variable",
					"Verify the correctness of your Git installation"
				]
			),
			logger
		);
	}
	
	let templates = fallbackTemplateRepoList;
	try {
		templates = await loadTemplates();
	} catch (error) {
		logger.error(error);
		if (!(template in templates))
			handleError(
				new KnownError(
					"Could not load repositories from GitHub.",
					[
						"Make sure that you have an active internet connection"
					]
				),
				logger
			);
	}

	if (!(template in templates)) {
		handleError(
			new KnownError(
				`UIX Template with name '${template}' is not available.`,
				[`Please ensure that you select a template from the list below:\n${Object.keys(templates).map(e => `  ➜ ${e}`).join("\n")}`]
			),
			logger
		);
	}

	const templateRepo = templates[(template as keyof typeof templates)];
	const gitRepo = templateRepo.url;
	const cwd = new Path(path??'./', 'file://' + Deno.cwd() + '/');
	let projectName: string|undefined = undefined;
	let projectPath: Path;
	if (!name) {
		while (!projectName) {
			projectName = prompt(ESCAPE_SEQUENCES.BOLD+"Choose a name for your project:"+ESCAPE_SEQUENCES.RESET, templateRepo.repo)!;
		}
		do {
			name = prompt(ESCAPE_SEQUENCES.BOLD+"Enter a name for the project directory:"+ESCAPE_SEQUENCES.RESET, projectName?.toLowerCase().replace(/[^\w]/g, "-") || "uix-project")!;
			projectPath = cwd.getChildPath(name).asDir();
		}
		while (projectPath.fs_exists && 
			(logger.error(`The directory ${projectPath.normal_pathname} already exists. Please choose a different directory.`), true)
		)
	}
	else {
		if (name === '.') {
			projectName = templateRepo.repo;
			projectPath = cwd;
		} else {
			projectName = name;
			projectPath = cwd.getChildPath(name).asDir();
			if (projectPath.fs_exists)
				handleError(`The directory ${projectPath.normal_pathname} exists already. Please choose a different name.`, logger);
		}
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
					[
						"Check your internet connection",
						`Try to clone it manually (${gitRepo})`
					]
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
					[
						"Try to initialize it manually"
					]
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