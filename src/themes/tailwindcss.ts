import { UIX } from "../../uix.ts";
import type { Theme } from "../base/theme-manager.ts";
import { Path } from "../utils/path.ts";
import { Logger } from "datex-core-legacy/utils/logger.ts";

export const tailwindcss = {
	name: 'tailwindcss',
	stylesheets: [
		UIX.cacheDir.getChildPath("tailwind-styles.css")
	],
	async onRegister() {
		const { app } = await import("../app/app.ts" /*lazy*/);
		const { watch, watch_backend, live } = await import("../app/args.ts" /*lazy*/);

		const logger = new Logger("tailwindcss")
		const cmd = "tailwindcss"

		// install tailwindcss via npm if not available
		let cmdAvailable = new Deno.Command("which", {args:[cmd]}).outputSync().code == 0;

		if (!cmdAvailable) {
			const npmInstalled = new Deno.Command("which", {args:["npm"]}).outputSync().code == 0;
			if (npmInstalled) {
				logger.info("installing via npm...");
				cmdAvailable = new Deno.Command("npm", {args:["install", "-g", cmd]}).outputSync().code == 0;
				if (!cmdAvailable) {
					logger.error("Could not install tailwindcss. Try to install it manually (https://tailwindcss.com/docs/installation)")
					return;
				}
			}
			else {
				logger.error("Could not install tailwindcss. Please install npm.")
				return;
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

		const version = new TextDecoder().decode((await new Deno.Command(cmd, {args: cmdAvailable ? ['--help'] : ['tailwindcss', '--help'], stdout: "piped"}).spawn().output()).stdout).trim().split("\n")[0];
		logger.info("using", version);

		const args =  [
			"-i",
			inFile.normal_pathname,
			"-o",
			outFile.normal_pathname
		]
		if (watch || watch_backend || live) {
			logger.info("watching files");
			args.push("--watch")
		}

		const status = await new Deno.Command(cmd, {args}).spawn().status
		if (status.code != 0) logger.error("Error running tailwindcss")
	}
} satisfies Theme