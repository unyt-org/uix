import { Datex } from "datex-core-legacy/mod.ts";
import { normalizedAppOptions } from "../app/options.ts";
import { Path } from "../utils/path.ts";

/**
 * command line params + files
 */
export type runParams = {
    reload: boolean | undefined;
    enableTLS: boolean | undefined;
    inspect: string | undefined;
    unstable: boolean | undefined;
	detach: boolean | undefined;
    deno_config_path: string | URL | null;
}

export type runOptions = {
	params: runParams,
	baseURL: URL,
	options: normalizedAppOptions,
	backend: Path,
	endpoint?: Datex.Endpoint,
	domains: Record<string, number|null>,
	volumes?: URL[]
}

export interface UIXRunner {
	name: string
	run(options: runOptions): Promise<void>|void
}