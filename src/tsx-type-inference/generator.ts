import ts from "npm:typescript";
import { SourceFile } from "npm:typescript";
import { CompilerOptions } from "npm:typescript";
import { ResolvedProjectReference } from "npm:typescript";
import { StringLiteralLike } from "npm:typescript";
import { encodeHex } from "jsr:@std/encoding/hex";
import { sha256 } from "./sha256.js";
import { stdout } from "node:process";

export type TypeInferenceOptions = {
	/**
	 * list of source file paths from which all tsx files are resolved
	 */
	sourcePaths: (string | URL)[],
	/**
	 * Enables the ts file watcher, providing more performant incremental updates
	 */
	watch?: boolean,
	/**
	 * When enabled, reactivity is determined by the presence of a special #__ref__ marker property in the type of the attribute
	 * Otherwise, reactivity is determined by the presence of a type with the name "Ref", "RefLike" or "ReactiveValue".
	 */
	detectRefMarkers?: boolean,
	/**
	 * Map of import paths to their corresponding paths. Only file paths are supported.
	 */
	imports?: Record<string, string>,
	/**
	 * Path to the import map file
	 */
	importMapPath?: string,
	/**
	 * jsxImportSource compiler option
	 */
	jsxImportSource?: string
}


export type Positions = Map<string, number[]>;

export type PositionsData = {
	attrIndex: number,
	positions: Positions,
}

export class TSXTypeInferenceGenerator {

	#options: TypeInferenceOptions;
	#compilerOptions: ts.CompilerOptions;
	#watchProgram?: ts.WatchOfFilesAndCompilerOptions<ts.BuilderProgram>;
	#sourcePaths!: string[];
	#typeChecker!: ts.TypeChecker;

	#intiializePromise: Promise<void> | undefined;

	#unresolvedFiles = new Set<string>();

	static refTypes = ["Ref", "RefLike", "ReactiveValue"];

	constructor(options: TypeInferenceOptions) {
		this.#options = options;

		const paths = this.#options.imports ?
			this.#importMapToPaths(this.#options.imports!, this.#options.importMapPath) :
			{};

		this.#compilerOptions = {
			jsx: ts.JsxEmit.ReactJSX,
			jsxImportSource: this.#options.jsxImportSource,
			allowImportingTsExtensions: true,
			module: ts.ModuleKind.NodeNext,
			noEmit: true,
			target: ts.ScriptTarget.ESNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
			allowJs: true,
			esModuleInterop: true,
			strict: true,
			paths
		};
		
	}

	/**
	 * Finds all code positions of JSX attribute assignments that require reactive updates
	 * Reactivity is determined by the presence of a special #__ref__ marker property in the type of the attribute
	 * 
	 * @returns Array with file paths and positions 
	 */
	public async getReactivePositions(tryCache = true): Promise<Positions> {
		await this.#init();

		const program = this.#watchProgram ?
			this.#watchProgram.getProgram().getProgram() :
			ts.createProgram(this.#sourcePaths, this.#compilerOptions, this.#getCompilerHost());
		this.#typeChecker = program.getTypeChecker();

		const positions = this.#getReactivePositionsForProgram(program);

		// cache missing dependencies
		if (this.#unresolvedFiles.size > 0 && tryCache) {
			stdout.write("Caching " + this.#unresolvedFiles.size + (this.#unresolvedFiles.size == 1 ? " dependency" : " dependencies") + "...");
			await TSXTypeInferenceGenerator.cacheDependencies([...this.#unresolvedFiles]);
			this.#unresolvedFiles.clear();
			// completely reset watch program
			if (this.#options.watch) {
				this.#initWatchProgram();
			}
			return this.getReactivePositions(false);
		}
		else if (this.#unresolvedFiles.size > 0) {
			console.warn("Could not resolve the following files:", this.#unresolvedFiles);
		}


		return positions;
	}

	public static async cacheDependencies(dependencies: (URL|string)[]) {
		await new Deno.Command("deno", {
			args: ["cache", "-I", ...dependencies.map((dep) => dep.toString())],
			stdout: "piped",
		}).output();
	}

	#getReactivePositionsForProgram(program: ts.Program): Positions {
		const positions: Positions = new Map();

		program.getSourceFiles().forEach((sourceFile) => {
			// skip non-tsx files
			if (sourceFile.languageVariant !== ts.LanguageVariant.JSX) return;

			const fileIdentifier = this.#denoCacheFileUrls.get(sourceFile.fileName) || ('file://' + sourceFile.fileName);

			positions.set(fileIdentifier, []);
			const positionsData: PositionsData = { attrIndex: 0, positions: positions };

			this.#visit(sourceFile, positionsData);
		});

		// for (const [file] of positions) {
		// 	// fix for remote cached modules: remove transpile cache for each file to force recompilation
		// 	if (file.startsWith("http://") || file.startsWith("https://")) {
		// 		this.#deleteDenoTranspileCacheForFile(file);
		// 	}
		// }
		return positions;
	}

	#deleteDenoTranspileCacheForFile(file: string) {
		const resolvedModuleURL = new URL(file);
		const basePath = this.#denoCacheDirs.typescriptCache;
		const pathHash = encodeHex(sha256(resolvedModuleURL.pathname) as Uint8Array);
		const fullPath = `${basePath}/${resolvedModuleURL.protocol.slice(0,-1)}/${resolvedModuleURL.host}/${pathHash}.js`;
		console.log("deleting cache for", file, fullPath);
		try {
			Deno.removeSync(fullPath);
		}
		catch {
			// ignore
		}
	}

	async #init() {
		if (this.#intiializePromise) return this.#intiializePromise;
		const {promise, resolve} = Promise.withResolvers<void>();
		this.#intiializePromise = promise;

		this.#denoCacheDirs = await this.#getDenoCacheDir();

		this.#sourcePaths = this.#options.sourcePaths.map((sourcePath) => {
			if (sourcePath instanceof URL) return sourcePath.pathname;
			else return sourcePath
		});

		if (this.#options.watch) {
			this.#initWatchProgram();
		}

		resolve();
	}

	#initWatchProgram() {
		const host = ts.createWatchCompilerHost(
			this.#sourcePaths, 
			this.#compilerOptions, 
			ts.sys,
			undefined,
			() => {}, // Empty diagnostic reporter (no logging)
			() => {} // Empty watch status change handler
		);
		host.resolveModuleNameLiterals = (moduleLiterals: readonly StringLiteralLike[], containingFile: string, redirectedReference: ResolvedProjectReference | undefined, options: CompilerOptions, containingSourceFile: SourceFile, reusedNames: readonly StringLiteralLike[] | undefined) =>
			this.#customModuleResolver(moduleLiterals, containingFile, redirectedReference, options, containingSourceFile, reusedNames);

		this.#watchProgram = ts.createWatchProgram(host);
	}

	#denoCacheDirs!: {modulesCache: string, typescriptCache: string};
	#denoCacheFileUrls = new Map<string, string>();

	async #getDenoCacheDir() {
		const output = await new Deno.Command("deno", {args: ["info", "--json"]}).output();
		const info = JSON.parse(new TextDecoder().decode(output.stdout));
		return info as {modulesCache: string, typescriptCache: string};
	}

	#getLocalDenoCacheFile(moduleURL: string, extension?: string) {
		// file urls must not be resolved
		if (moduleURL.startsWith("file://")) return;
		// check if Url can be parsed
		if (!URL.canParse(moduleURL)) return;
		const resolvedModuleURL = new URL(moduleURL);
		const basePath = this.#denoCacheDirs.modulesCache;
		const pathHash = encodeHex(sha256(resolvedModuleURL.pathname) as Uint8Array);
		const fullPath = `${basePath}/${resolvedModuleURL.protocol.slice(0,-1)}/${resolvedModuleURL.host}/${pathHash}`;
		const newPath = fullPath + (extension||"");

		this.#denoCacheFileUrls.set(newPath, moduleURL);
		// check if fullPath exists
		try {
			Deno.statSync(fullPath);
			if (extension) {
				// copy file next with .tsx extension, required for correct parsing
				Deno.copyFileSync(fullPath, newPath);
			}
		}
		catch {
			this.#unresolvedFiles.add(moduleURL);
		}
		
		return newPath;
	}

	#resolveModule(moduleName: string, containingFile?: string) {
		// resovle specifier path
		// already an http path
		if (moduleName.startsWith("http://") || moduleName.startsWith("https://")) return moduleName;

		// if relative path, try to resolve
		if (moduleName.startsWith("./") || moduleName.startsWith("../")) {
			if (!containingFile) throw new Error("containing file required for relative paths");
			let parentFile = this.#denoCacheFileUrls.get(containingFile) || containingFile;
			if (parentFile.startsWith("/")) parentFile = "file://" + parentFile;
			const resolvedPath = new URL(moduleName, parentFile).toString();
			return resolvedPath;
		}

		// get first part of path and check if in imports
		const firstPart = moduleName.split("/")[0] + "/";

		// find direct match in import map
		const importMapValue = this.#options.imports![moduleName];
		if (importMapValue) {
			return importMapValue;
		}

		let resolvedPath = this.#options.imports![firstPart];
		if (resolvedPath) {
			// if path is relative, resolve
			if (resolvedPath.startsWith("./") || resolvedPath.startsWith("../")) {
				if (!this.#options.importMapPath) throw new Error("importMapPath required for relative paths");
				const importMapPath = this.#options.importMapPath.startsWith("file://") ? this.#options.importMapPath : 'file://' + this.#options.importMapPath;
				resolvedPath = new URL(resolvedPath, importMapPath).toString();
			}
			const res = new URL("./" + moduleName.replace(firstPart, ""), resolvedPath).toString();
			//console.log("resolved:", moduleName, res);
			return res;
		}

		
	}

	#customModuleResolver(moduleLiterals: readonly StringLiteralLike[], containingFile: string, redirectedReference: ResolvedProjectReference | undefined, options: CompilerOptions, containingSourceFile: SourceFile, reusedNames: readonly StringLiteralLike[] | undefined): readonly ts.ResolvedModuleWithFailedLookupLocations[] {
		return moduleLiterals.map((moduleLiteral) => {

			if (moduleLiteral.text.startsWith("node:") || moduleLiteral.text.startsWith("npm:") || moduleLiteral.text.startsWith("jsr:") || moduleLiteral.text.startsWith("https://deno.land/") || moduleLiteral.text.startsWith("https://jsr.io/")) {
				return {
					resolvedModule: {
						extension: ts.Extension.Ts,
						resolvedFileName: moduleLiteral.text,
					}
				}
			}


			const mod = this.#resolveModule(moduleLiteral.text, containingFile)??moduleLiteral.text;
			const resolvedPath = this.#getLocalDenoCacheFile(mod, mod.endsWith(".tsx") ? '.tsx' : undefined) || mod.replace("file://", "");

			return {
				resolvedModule: {
					extension: resolvedPath.endsWith(".tsx") || mod.endsWith(".tsx") ? ts.Extension.Tsx : ts.Extension.Ts,
					resolvedFileName: resolvedPath,
					moduleName: mod,
					resolvedUsingTsExtension: false
				}
			}
		})
	}

	#compilerHost?: ts.CompilerHost;
	#getCompilerHost() {
		if (this.#compilerHost) return this.#compilerHost;

		// Create a custom compiler host
		const compilerHost: ts.CompilerHost = ts.createCompilerHost({});
		compilerHost.resolveModuleNameLiterals = (moduleLiterals: readonly StringLiteralLike[], containingFile: string, redirectedReference: ResolvedProjectReference | undefined, options: CompilerOptions, containingSourceFile: SourceFile, reusedNames: readonly StringLiteralLike[] | undefined) =>
			this.#customModuleResolver(moduleLiterals, containingFile, redirectedReference, options, containingSourceFile, reusedNames);
		this.#compilerHost = compilerHost;
		return compilerHost
	}

	/**
	 * Converts an import map to a paths object required by the TypeScript compiler
	 * @param importMap imports map
	 * @param importMapPath path where the import map is located, required for resolving relative paths
	 * @returns paths object
	 */
	#importMapToPaths(importMap: Record<string, string>, importMapPath?: string): Record<string, string[]> {

		// only file import map path supported
		if (importMapPath && !(importMapPath.startsWith("file://") || importMapPath.startsWith("/"))) {
			throw new Error("Only file import map paths are supported");
		}
		if (importMapPath && !importMapPath.startsWith("file://")) {
			importMapPath = "file://" + importMapPath;
		}

		const paths: Record<string, string[]> = {};
		for (const [key, value] of Object.entries(importMap)) {
			// skip http imports
			if (value.startsWith("http://") || value.startsWith("https://")) continue;
			const absolutePath = importMapPath ? new URL(value, importMapPath).pathname : value;
			const mappedKey = key.endsWith("/") ? key + "*" : key;
			const mappedValue = absolutePath.endsWith("/") ? absolutePath + "*" : absolutePath;
			paths[mappedKey] = [mappedValue];
		}
		return paths;
	}


	#isRef(type: ts.Type) {
		if (this.#options.detectRefMarkers) {
			return type.getProperties().some((prop) => {
				return prop.getName() == "#__ref__"
			})
		}
		else {
			const typeName = this.#typeChecker.typeToString(type);
			// remove generics
			const typeBaseName = typeName.split("<")[0];
			return TSXTypeInferenceGenerator.refTypes.includes(typeBaseName);
		}
	}

	#jsxAttributeIsLiteral(node: ts.Node) {
		if (ts.isStringLiteral(node)) return true;
		if (ts.isJsxExpression(node) && node.expression) {
			return (
				ts.isStringLiteral(node.expression) ||
				ts.isNumericLiteral(node.expression) ||
				ts.isBigIntLiteral(node.expression) ||
				ts.isIdentifier(node.expression) ||
				node.expression.kind == ts.SyntaxKind.TrueKeyword ||
				node.expression.kind == ts.SyntaxKind.FalseKeyword ||
				node.expression.kind == ts.SyntaxKind.NullKeyword || 
				node.expression.kind == ts.SyntaxKind.UndefinedKeyword ||
				ts.isFunctionExpression(node.expression) ||
				ts.isArrowFunction(node.expression)
			)
		}
	}

	#visitAttribute(node: ts.Node, isBoolNode: boolean, positionsData: PositionsData) {


		if (ts.isJsxExpression(node) || ts.isStringLiteral(node) || isBoolNode) {

			const parent = isBoolNode ? node.parent.parent : node.parent.parent.parent;

			const jsxEl = parent as ts.JsxOpeningElement||ts.isJsxSelfClosingElement;
			const requiredType = this.#typeChecker.getContextualType(
				isBoolNode ? 
					node.getChildAt(0) as ts.Expression :
					node as ts.Expression
			);
			const isCustomComponent = /[A-Z]/.test(jsxEl.tagName?.getText()[0]);

			if (!requiredType && isCustomComponent) {
				throw new Error(""+node.getSourceFile().fileName+": Could not find type for attribute " + node.parent.getText());
			}
	
			// if union, iterate over types
			let hasRefMarker = false;
			if (requiredType?.isUnion()) {
				hasRefMarker = requiredType!.types.some((type) => {
					return this.#isRef(type)
				});
			}
			else {
				hasRefMarker = requiredType ? this.#isRef(requiredType) : false;
			}
	
			// optimization: skip ref for internal elements if literal value (they all accept either refs or const values, so we can just skip them)
			const skipRefForInternalElement = hasRefMarker && !isCustomComponent && this.#jsxAttributeIsLiteral(node);

			if (hasRefMarker && !skipRefForInternalElement) {

				//console.log(this.#typeChecker.typeToString(requiredType!), node.pos, node.getText());
				// append pos as new line to file
				const sourceFile = node.getSourceFile();
				const fileIdentifier = this.#denoCacheFileUrls.get(sourceFile.fileName) || ('file://' + sourceFile.fileName);
				if (!positionsData.positions.has(fileIdentifier)) positionsData.positions.set(fileIdentifier, []);
				positionsData.positions.get(fileIdentifier)!.push(positionsData.attrIndex);
				if (this.#typeChecker.typeToString(requiredType!) == "unknown") {
					console.error("Error: unknown type at " + fileIdentifier + ":" + node.pos);
				}
			}
		}

		positionsData.attrIndex++;
	
		node.forEachChild(c => this.#visit(c, positionsData));
	}

	// Recursive function to iterate over nodes
	#visit(node: ts.Node, positions: PositionsData) {
		// If node is a JSX element, visit its attributes	
		if (ts.isJsxAttribute(node)) {
			this.#visitAttribute(node.initializer ?? node, !node.initializer, positions)
		}
	
		// Recursively visit all child nodes
		else node.forEachChild(c => this.#visit(c, positions));
	}
}

