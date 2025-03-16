import { encodeHex } from "jsr:@std/encoding@0.221/hex";
import { Positions, TSXTypeInferenceGenerator } from "../tsx-type-inference/generator.ts";
import { sha256 } from "../tsx-type-inference/sha256.js";
import { normalizedAppOptions } from "../app/options.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { getExistingFileExclusive } from "../utils/file-utils.ts";
import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";
import { watch } from "../app/args.ts";
import { live } from "../app/args.ts";
import { watch_backend } from "../app/args.ts";
import { stdout } from "node:process";

const metadataDir = new Path("./uix/jusix/metadata/", cache_path).asDir();
if (!metadataDir.fs_exists) Deno.mkdirSync(metadataDir, {recursive: true})

export async function generateReactiveIndices(options: normalizedAppOptions, onUpdate?: () => void) {
	if (!options.import_map.path) throw new Error("Import map path must be defined")

	await cacheDependencies();

	// get entrypoints
	const entrypoints = [];
	for (const scope of options.backend) {
		const entrypoint = getEntrypoint(scope)
		if (entrypoint) entrypoints.push(entrypoint.normal_pathname)
	}
	for (const scope of options.frontend) {
		const entrypoint = getEntrypoint(scope)
		if (entrypoint) entrypoints.push(entrypoint.normal_pathname)
	}
	
	const watchEnabled = watch || watch_backend || live;

	// entrypoints.push("uix/html/template.ts")

	await generateReactiveIndicesForEntrypoints(
		entrypoints,
		options.import_map.path.toString(),
		options.import_map.imports,
		watchEnabled,
		onUpdate
	)
}

// make sure all required depencency modules are cached locally by Deno
async function cacheDependencies() {
	const templatePath = new Path("../html/template.ts", import.meta.url);
	stdout.write("[JUSIX] Loading dependencies into cache...")
	await new Deno.Command("deno", {
		args: ["cache", templatePath.toString()],
		stdout: "piped",
	}).output();
	stdout.write("done\n")
}


function getEntrypoint(path: Path) {
	const entrypoint = getExistingFileExclusive(path, 'entrypoint.ts', 'entrypoint.tsx');
	if (entrypoint) return new Path(entrypoint);
}


async function generateReactiveIndicesForEntrypoints(
	entrypoints: string[],
	importMapPath: string,
	imports: Record<string, string>,
	watch: boolean,
	onUpdate?: () => void
) {
	const generator = new TSXTypeInferenceGenerator({
		sourcePaths: entrypoints,
		importMapPath,
		imports,
		watch,
		jsxImportSource: "jusix",
		detectRefMarkers: true
	})

	stdout.write("[JUSIX] Generating reactive indices...")
	const reactiveIndices = await generator.getReactivePositions();
	stdout.write("done\n")	
	handleReactiveIndices(reactiveIndices);
	onUpdate?.();

	if (watch) {
		const handler = (reactiveIndices: Positions) => {
			console.log("[JUSIX] Updated reactive indices")
			handleReactiveIndices(reactiveIndices);
			onUpdate?.();
		}
		generator.onUpdate(handler);
	}

}

function handleReactiveIndices(reactiveIndices: Positions) {
	console.log("inidices", reactiveIndices)
	for (const [file, indices] of reactiveIndices) {
		saveReactiveIndices(file, indices);
	}
}


function saveReactiveIndices(modulePath: string, indices: number[]) {
	const hash = encodeHex(sha256('file://' + modulePath) as Uint8Array);
	const path = metadataDir.getChildPath(hash);
	// save indices to path
	if (indices.length) {
		Deno.writeTextFile(path, indices.join(","))
	}
	// delete file if no indices
	else if (path.fs_exists) {
		Deno.remove(path)
	}
}