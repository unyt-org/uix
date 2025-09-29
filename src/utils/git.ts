import { Path } from "datex-core-legacy/utils/path.ts";

export function isGitInstalled(): boolean {
	try {
		return new Deno.Command("git", { args: ["--version"] }).outputSync().success;
	} catch {
		return false;
	}
}

export class GitRepo {

	#origin!: string
	#branch!: string

	get origin() {return this.#origin}
	get branch() {return this.#branch}

	private constructor() {
	}

	public async getOrigin() {
		this.#origin = await git(["config", "--get", "remote.origin.url"]);
		return this.origin;
	}

	public async getBranch() {
		this.#branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
		return this.branch;
	}

	public async getRootPath() {
		return Path.File(await git(["rev-parse", "--show-toplevel"])).asDir();
	}

	public async getUnaddedFiles() {
		return await git(["ls-files", "--deleted", "--modified", "--others", "--exclude-standard", "--", ":/"]);
	}

	public async getUncommittedChanges() {
		return await git(["diff", "HEAD", "--name-only"]);
	}

	public async hasUnpushedChanges() {
		return (await git(["status"])).includes("Your branch is ahead of");
	}

	public static async get() { // path: Path
		try {
			const gitRepo = new GitRepo();
			await gitRepo.getOrigin();
			await gitRepo.getBranch();

			return gitRepo;
		} catch {
			return null;
		}
	}


	public async initWorkflowDirectory() {
		// TODO: also support gitlab
		const root = await this.getRootPath();
		const workflowDir = root.getChildPath(".github/workflows").asDir();
		if (!workflowDir.fs_exists) await Deno.mkdir(workflowDir, {recursive: true});
		return workflowDir;
	}
	
}

/**
 * Executes the git CLI with the specified arguments
 * and returns its stdout.
 * 
 * @param args command line arguments
 * @returns git's stdout output
 */
async function git(args: string[]) {
	const process = new Deno.Command("git", { args , stderr: "piped", stdout: "piped" }).spawn();

	if ((await process.status).code !== 0)
		throw new Error("Git execution failed", { cause: new TextDecoder().decode((await process.output()).stderr).trimEnd() });

	return new TextDecoder().decode((await process.output()).stdout).trimEnd();
}
