import { OutputMode, exec as _exec } from "https://deno.land/x/exec@0.0.5/mod.ts";
import { Path } from "unyt_node/path.ts";

const CMD = {
	GET_BRANCH: 'git rev-parse --abbrev-ref HEAD',
	GET_ORIGIN: 'git config --get remote.origin.url',
	GET_UNADDED_FILES: 'git ls-files --deleted --modified --others --exclude-standard -- :/',
	GET_UNCOMMITTED_CHANGES: 'git diff HEAD  --name-only',
	GET_ROOT_PATH: 'git rev-parse --show-toplevel',
	GET_STATUS: 'git status'
} as const;

export class GitRepo {

	#origin!: string
	#branch!: string

	get origin() {return this.#origin}
	get branch() {return this.#branch}

	private constructor() {
	}

	public async getOrigin() {
		this.#origin = await exec(CMD.GET_ORIGIN);
		return this.origin
	}

	public async getBranch() {
		this.#branch = await exec(CMD.GET_BRANCH);
		return this.branch
	}

	public async getRootPath() {
		return Path.File(await exec(CMD.GET_ROOT_PATH)).asDir();
	}

	public async getUnaddedFiles() {
		return await exec(CMD.GET_UNADDED_FILES);
	}

	public async getUncommittedChanges() {
		return await exec(CMD.GET_UNCOMMITTED_CHANGES);
	}

	public async getHasUnpushedChanges() {
		return (await exec(CMD.GET_STATUS)).includes("Your branch is ahead of");
	}

	public static async get() { // path: Path
		const gitRepo = new GitRepo();
		await gitRepo.getOrigin();
		await gitRepo.getBranch();

		return gitRepo;
	}


	public async initWorkflowDirectory() {
		// TODO: also support gitlab
		const root = await this.getRootPath()
		const workflowDir = root.getChildPath(".github/workflows").asDir();
		if (!workflowDir.fs_exists) await Deno.mkdir(workflowDir, {recursive: true});
		return workflowDir;
	}
	
}

async function exec(cmd: string) {
	const {output} = await _exec(cmd, {output: OutputMode.Capture});
	return output;
}