import { command_line_options } from "./args.ts";

export const watch_backend = command_line_options.option("generate-static-files", {type:"boolean", default: false, description: "Generate all static files for the backend entrypoint routes"});
if (watch_backend) generateStaticFilesForBackendEntrypoint();

export function generateStaticFilesForBackendEntrypoint() {
	// TODO
}