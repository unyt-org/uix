import { Path } from "../utils/path.ts";
import { normalizedAppOptions } from "./options.ts";

export function getDirType(appOptions:normalizedAppOptions, path:Path) {	
	// backend path?
	for (const backend of appOptions.backend) {
		if (path.isChildOf(backend)) return 'backend'
	}

	// frontend path?
	for (const frontend of appOptions.frontend) {
		if (path.isChildOf(frontend)) return 'frontend'
	}

	// common path?
	for (const common of appOptions.common) {
		if (path.isChildOf(common)) return 'common'
	}
}