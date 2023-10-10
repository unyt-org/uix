import { doc } from "https://deno.land/x/deno_doc/mod.ts";
import { Path } from "uix/utils/path.ts";


export async function getEternalModule(filePath: Path, specifier: string) {
	const tree = await doc(filePath.toString(), {
		load: async (specifier) => {
			if (specifier == filePath.toString()) return {kind: "module", specifier, content: await Deno.readTextFile(filePath)};
			return {kind: "external", specifier};
		},
		resolve() {
			return "file://temp.ts"
		},
		printImportMapDiagnostics: true,
		includeAll: false
	}); 

	const exportNames = tree.filter(e=>e.declarationKind == "export").map(e=>e.name);

	let source = "";
	for (const exportName of exportNames) {
		if (exportName == "default") source += `export default await lazyEternalVar("${exportName}") ?? $$((await import("${specifier}"))["${exportName}"]);\n`;
		else source += `export const ${exportName} = await lazyEternalVar("${exportName}") ?? $$((await import("${specifier}"))["${exportName}"]);\n`;
	}

	return source;
}