import { Path } from "datex-core-legacy/utils/path.ts";
import type { normalizedAppOptions } from "./options.ts";

export interface AppPlugin<Data = unknown> {
	name: string
	apply(data:Data, rootPath:Path.File, appOptions:normalizedAppOptions): Promise<void>|void
}
