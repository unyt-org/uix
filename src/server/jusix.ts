import { getBaseDirectory } from "../utils/uix-base-directory.ts";
import { Logger } from "datex-core-legacy/utils/logger.ts";

const logger = new Logger("JUSIX");
let jusixLoading: Promise<string> | undefined;
const JUSIX_WASM_URL = "https://github.com/unyt-org/jusix/raw/wasm-plugin/jusix.wasm";

export async function getJusix(update = false) {
	if (jusixLoading) return jusixLoading;
	const {promise, resolve} = Promise.withResolvers<string>()
	jusixLoading = promise;

	const wasmPath = getBaseDirectory().getChildPath("jusix.wasm");

	// if wasm file does not exist or update is forced, download
	if (update || !await wasmPath.fsExists()) {
		logger.info("updating...");
		// download jusix
		const response = await fetch(JUSIX_WASM_URL);
		// save in deno dir
		const bin = await response.arrayBuffer();
		await Deno.writeFile(wasmPath.normal_pathname, new Uint8Array(bin));
		logger.success("updated");
	}
	resolve(wasmPath.normal_pathname);
	return wasmPath.normal_pathname;
}