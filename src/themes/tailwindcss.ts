// deno-lint-ignore-file no-async-promise-executor
import { UIX } from "../../uix.ts";
import type { Theme } from "../base/theme-manager.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { Logger } from "datex-core-legacy/utils/logger.ts";
import { getBaseDirectory, getOS } from "../utils/uix-base-directory.ts";
import { KnownError, handleError } from "datex-core-legacy/utils/error-handling.ts";
import { registerBuildLock } from "../app/build-lock.ts";

export const tailwindcss = {
	name: 'tailwindcss',
	stylesheets: [
		UIX.cacheDir.getChildPath("tailwind-styles.css")
	],
	async onRegister() {
		const { app } = await import("../app/app.ts" /*lazy*/);
		const { watch, watch_backend, live } = await import("../app/args.ts" /*lazy*/);

		const logger = new Logger("tailwindcss")

		// install tailwindcss via GitHub Releases if not available
		const executableTarget = getBaseDirectory().getChildPath("tailwindcss");
		let tailwindCssCmd = "tailwindcss"
		let cmdAvailable = commandExists(tailwindCssCmd);
		if (!cmdAvailable) {
			tailwindCssCmd = executableTarget.normal_pathname
			cmdAvailable = commandExists(tailwindCssCmd);
		}

		if (!cmdAvailable) {
			const os = getOS();
			const executableName = {
				'linux-x86_64': "tailwindcss-linux-x64",
				'linux-aarm': "tailwindcss-linux-arm64",
				'windows-x86_64': "tailwindcss-windows-x64.exe",
				'windows-aarch64': "tailwindcss-windows-arm64.exe",
				'darwin-x86_64': "tailwindcss-macos-arm64",
				'darwin-aarch64': "tailwindcss-macos-x64"
			}[os];
			if (!executableName)
				handleError(
					new KnownError(
						`TailwindCSS executable could not be installed for your platform (${os}).`,
						["Please open an issue on https://www.github.com/unyt-org/uix providing your platform details"]
					),
					logger
				);
			
			try {
				logger.info("Downloading TailwindCSS. HTTP requests / page loads will be deferred until the installation is complete.");
				const downloadMap = await datex.get<{assets: {browser_download_url: string, name: string}[]}>("https://api.github.com/repos/tailwindlabs/tailwindcss/releases/latest");
				const releaseURL = downloadMap.assets.find(e => e.name === executableName)?.browser_download_url;
				if (!releaseURL)
					throw new Error(`Could not get release URL for ${executableName}`);

				await Deno.writeFile(
					executableTarget.normal_pathname,
					new Uint8Array(await (await fetch(releaseURL)).arrayBuffer()),
					{
						create: true
					}
				);

				try {
					await Deno.chmod(
						executableTarget.normal_pathname,
						0o777
					);
				}
				catch  {
					// ignore if chmod fails on Windows
				}
				logger.success(`TailwindCSS was installed to ${executableTarget}`);
			} catch (e) {
				handleError(
					new KnownError(
						`The TailwindCSS executable could not be downloaded\n(${e})`,
						[
							"Check your internet connectivity",
							"Ensure that you have enough disk space and that the directory is writable"
						]
					),
					logger
				);
			}
		}

		const outFile = new Path(this.stylesheets![0]);
		const inFile = new Path(app.base_url).getChildPath("tailwind.css");
		const configFile = new Path(app.base_url).getChildPath("tailwind.config.js");

		if (!inFile.fs_exists) {
			Deno.writeTextFileSync(inFile.normal_pathname, '@tailwind base;\n@tailwind components;\n@tailwind utilities;')
		}
		if (!configFile.fs_exists) {	
			Deno.writeTextFileSync(configFile.normal_pathname, 'export default {\n  content: ["./**/*.{html,tsx,ts,jsx,js}"],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}')
		}

		try {
			console.log("running", tailwindCssCmd)
			const version = new TextDecoder().decode((await new Deno.Command(tailwindCssCmd, {args: ['--help'], stdout: "piped"}).spawn().output()).stdout).trim().split("\n")[0];
			logger.info("using", version);
	
			const args =  [
				"-i",
				inFile.normal_pathname,
				"-c",
				configFile.normal_pathname,
				"-o",
				outFile.normal_pathname
			]
			if (watch || watch_backend || live) {
				logger.info("watching files");
				args.push("--watch");
			}
	

			const status = new Deno.Command(tailwindCssCmd, {args, stderr: "piped", stdout: "piped"}).spawn();
			const decoder = new TextDecoder();
			let resolver: (() => void) | undefined = undefined;
			let isResolved = false;

			for await (const data of status.stderr) {
				const out = decoder.decode(data);
				if (out.includes("Done in")) {
					logger.success("finished building");
					isResolved = true;
					resolver?.();
				} else if (out.includes("Rebuilding...")) {
					isResolved = false;
					const { promise, resolve, reject } = Promise.withResolvers<void>();
					resolver = resolve;
					registerBuildLock(Promise.race<void>([
						promise,
						sleep(10_000).then(()=> {
							if (!isResolved)
								logger.warn("TailwindCSS has not finished building in 10s");
						}).catch(reject)
					]));
				}
			}
			if ((await status.status).code != 0)
				logger.error("Error running tailwindcss");
		}
		catch (e) {
			logger.error(e);
		}
	}
} satisfies Theme;


function commandExists(cmd: string, arg = "-h") {
	try {
		console.log(new TextDecoder().decode(new Deno.Command(cmd, {args:[arg]}).outputSync().stderr));
		return true;
	}
	catch {
		return false;
	}
}