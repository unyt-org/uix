import { encodeHex } from "jsr:@std/encoding@0.221/hex";
import { Positions, TSXTypeInferenceGenerator } from "../tsx-type-inference/generator.ts";
import { sha256 } from "../tsx-type-inference/sha256.js";
import { normalizedAppOptions } from "../app/options.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";
import { stdout } from "node:process";
import { debounce } from "https://deno.land/std@0.104.0/async/debounce.ts";
import { ESCAPE_SEQUENCES, Logger } from "datex-core-legacy/utils/logger.ts";
import { walk } from "jsr:@std/fs@0.221/walk";

const logger = new Logger("JUSIX", true)

const metadataDir = new Path("./uix/jusix/metadata/", cache_path).asDir();
// reset metadata directory
try {
	Deno.removeSync(metadataDir, {recursive: true});
}
catch {
	// ignore
}
Deno.mkdirSync(metadataDir, {recursive: true})


export async function generateReactiveIndices(rootPath: URL, options: normalizedAppOptions, watch: boolean, loadDependencies = true): Promise<{ update: () => Promise<void> }> {
	if (!options.import_map.path) throw new Error("Import map path must be defined")

	if (loadDependencies) await cacheDependencies();

	// get all modules
	const modulePaths = [];
	for await (const dirEntry of walk(rootPath, { exts: [".ts", ".tsx"] })) {
		modulePaths.push(dirEntry.path);
	}

	return await generateReactiveIndicesForModules(
		modulePaths,
		options.import_map.path.toString(),
		options.import_map.imports,
		watch
	)
}

// make sure all required depencency modules are cached locally by Deno
// TODO: this works for known dependencies (e.g. template.ts), but not all remote dependencies are cached or up to date - this is definitely a problem
async function cacheDependencies() {
	const templatePath = new Path("../html/template.ts", import.meta.url);
	await TSXTypeInferenceGenerator.cacheDependencies([templatePath])
}

async function generateReactiveIndicesForModules(
	modulePaths: string[],
	importMapPath: string,
	imports: Record<string, string>,
	watch: boolean,
): Promise<{ update: () => Promise<void> }> {
	const generator = new TSXTypeInferenceGenerator({
		sourcePaths: modulePaths,
		importMapPath,
		imports,
		watch,
		jsxImportSource: "jusix",
		detectRefMarkers: true
	})

	const reactiveIndices = await generator.getReactivePositions();
	// wait 50ms to show done message
	await new Promise(resolve => setTimeout(resolve, 50))
	handleReactiveIndices(reactiveIndices);

	if (watch) {
		await initRequestListener(generator);
	}

	return {
		async update() {
			const reactiveIndices = await generator.getReactivePositions();
			// wait 50ms to show done message
			await new Promise(resolve => setTimeout(resolve, 50))
			await handleReactiveIndices(reactiveIndices);
		}
	};
}

const handleRequest = debounce(async (generator: TSXTypeInferenceGenerator) => {
	const wipsParent = (await import("../utils/wips/wips-parent.ts")).wipsParent;
	const reactiveIndices = await generator.getReactivePositions();
	await handleReactiveIndices(reactiveIndices);
	wipsParent.sendMessage("tsc-index-generation-done");
}, 200);

async function initRequestListener(generator: TSXTypeInferenceGenerator) {
	const wipsParent = (await import("../utils/wips/wips-parent.ts")).wipsParent;
	wipsParent.onReceive(msg => {
		if (msg == "tsc-index-generation") {
			handleRequest(generator);
		}
	});
}


async function handleReactiveIndices(reactiveIndices: Positions) {
	const promises = [];
	for (const [modulePath, indices] of reactiveIndices) {
		promises.push(saveReactiveIndices(modulePath, indices));
	}
	await Promise.all(promises);
}


async function saveReactiveIndices(modulePath: string, indices: number[]) {
	const hash = encodeHex(sha256(
		new URL(modulePath).toString()
	) as Uint8Array);
	const path = metadataDir.getChildPath(hash);
	// save indices to path
	if (indices.length) {
		// create parent directory if not exists
		if (!await path.parent_dir.fsExists()) {
			await Deno.mkdir(path.parent_dir, {recursive: true})
		}
		await Deno.writeTextFile(path, indices.join(","))
	}
	// delete file if no indices
	else if (path.fs_exists) {
		await Deno.remove(path)
	}
}