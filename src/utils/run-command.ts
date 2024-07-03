export function runCommand(cmd: string, options: Deno.CommandOptions = {}): Deno.Command {
	// check if windows
	const isWindows = Deno.build.os == "windows";
	if (isWindows) {
		cmd = "cmd";
		if (!options?.args) options.args = [];
		options.args.unshift("/c", cmd);
	}
	return new Deno.Command(cmd, options);
}