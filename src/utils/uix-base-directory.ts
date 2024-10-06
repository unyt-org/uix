import { Path } from "datex-core-legacy/utils/path.ts";

export function getBaseDirectory() {
	return new Path(Deno.execPath()).parent_dir;
}

export function getOS() {
	const os = Deno.build.os;
	const arch = Deno.build.arch;
	return `${os}-${arch}`;
}