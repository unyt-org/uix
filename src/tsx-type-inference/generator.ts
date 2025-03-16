import ts from "npm:typescript";
import { SourceFile } from "npm:typescript";
import { CompilerOptions } from "npm:typescript";
import { ResolvedProjectReference } from "npm:typescript";
import { StringLiteralLike } from "npm:typescript";
import { encodeHex } from "jsr:@std/encoding/hex";
import { sha256 } from "./sha256.js";

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
	positions: Positions
}

export class TSXTypeInferenceGenerator {

	#options: TypeInferenceOptions;
	#compilerOptions: ts.CompilerOptions;
	#watchProgram?: ts.WatchOfFilesAndCompilerOptions<ts.BuilderProgram>;
	#sourcePaths!: string[];
	#typeChecker!: ts.TypeChecker;

	#intiializePromise: Promise<void> | undefined;

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

	#updatHandlers: Set<(positions: Positions) => void> = new Set();

	public onUpdate(callback: (positions: Positions) => void) {
		this.#updatHandlers.add(callback);
	}

	/**
	 * Finds all code positions of JSX attribute assignments that require reactive updates
	 * Reactivity is determined by the presence of a special #__ref__ marker property in the type of the attribute
	 * 
	 * @returns Array with file paths and positions 
	 */
	public async getReactivePositions(): Promise<Positions> {
		await this.#init();

		const program = this.#watchProgram ?
			this.#watchProgram.getProgram().getProgram() :
			ts.createProgram(this.#sourcePaths, this.#compilerOptions, this.#getCompilerHost());
		this.#typeChecker = program.getTypeChecker();

		return this.#getReactivePositionsForProgram(program);
	}

	#getReactivePositionsForProgram(program: ts.Program): Positions {
		const positions: Positions = new Map();

		program.getSourceFiles().forEach((sourceFile) => {
			// skip non-tsx files
			if (sourceFile.languageVariant !== ts.LanguageVariant.JSX) return;
			// console.log("Searching " + sourceFile.fileName);

			positions.set(sourceFile.fileName, []);
			const positionsData: PositionsData = { attrIndex: 0, positions: positions };

			this.#visit(sourceFile, positionsData);
		});
		return positions;
	}

	async #init() {
		if (this.#intiializePromise) return this.#intiializePromise;
		const {promise, resolve} = Promise.withResolvers<void>();
		this.#intiializePromise = promise;

		this.#denoRemoteModulesCacheDir = await this.#getDenoRemoteModulesCacheDir();

		this.#sourcePaths = this.#options.sourcePaths.map((sourcePath) => {
			if (sourcePath instanceof URL) return sourcePath.pathname;
			else return sourcePath
		});

		if (this.#options.watch) {
			const host = ts.createWatchCompilerHost(
				this.#sourcePaths, 
				this.#compilerOptions, 
				ts.sys,
				undefined,
				() => {}, // Empty diagnostic reporter (no logging)
				() => {}  // Empty watch status reporter (no logging)
			);
			host.resolveModuleNameLiterals = (moduleLiterals: readonly StringLiteralLike[], containingFile: string, redirectedReference: ResolvedProjectReference | undefined, options: CompilerOptions, containingSourceFile: SourceFile, reusedNames: readonly StringLiteralLike[] | undefined) =>
				this.#customModuleResolver(moduleLiterals, containingFile, redirectedReference, options, containingSourceFile, reusedNames);

			const originalAfterProgramCreate = host.afterProgramCreate;

			host.afterProgramCreate = program => {
			  	originalAfterProgramCreate!(program);
			  	if (this.#updatHandlers.size > 0) {
					const positions = this.#getReactivePositionsForProgram(program.getProgram());
					for (const handler of this.#updatHandlers) {
						handler(positions);
					}
				}
			};

			this.#watchProgram = ts.createWatchProgram(host);
		}

		resolve();
	}

	#denoRemoteModulesCacheDir!: string;
	#denoCacheFileUrls = new Map<string, string>();

	async #getDenoRemoteModulesCacheDir() {
		const output = await new Deno.Command("deno", {args: ["info", "--json"]}).output();
		const info = JSON.parse(new TextDecoder().decode(output.stdout));
		return info["modulesCache"];
	}

	#getLocalDenoCacheFile(moduleURL: string) {
		// file urls must not be resolved
		if (moduleURL.startsWith("file://")) return;
		// check if Url can be parsed
		if (!URL.canParse(moduleURL)) return;
		const resolvedModuleURL = new URL(moduleURL);
		const basePath = this.#denoRemoteModulesCacheDir;
		const pathHash = encodeHex(sha256(resolvedModuleURL.pathname) as Uint8Array);
		const fullPath = `${basePath}/${resolvedModuleURL.protocol.slice(0,-1)}/${resolvedModuleURL.host}/${pathHash}`;
		
		this.#denoCacheFileUrls.set(fullPath, moduleURL);
		
		return fullPath;
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

			if (moduleLiteral.text.startsWith("node:") || moduleLiteral.text.startsWith("npm:") || moduleLiteral.text.startsWith("jsr:")) {
				return {
					resolvedModule: {
						extension: ts.Extension.Ts,
						resolvedFileName: moduleLiteral.text,
					}
				}
			}


			const mod = this.#resolveModule(moduleLiteral.text, containingFile)??moduleLiteral.text;
			const resolvedPath = this.#getLocalDenoCacheFile(mod) || mod.replace("file://", "");

			return {
				resolvedModule: {
					extension: resolvedPath.endsWith(".tsx") ? ts.Extension.Tsx : ts.Extension.Ts,
					resolvedFileName: resolvedPath,
					moduleName: moduleLiteral.text
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

			const jsxEl = node.parent.parent.parent as ts.JsxOpeningElement||ts.isJsxSelfClosingElement;
			const requiredType = this.#typeChecker.getContextualType(node as ts.Expression);
			const isCustomComponent = /[A-Z]/.test(jsxEl.tagName?.getText()[0]);

			// attribute type error/warning - only for custom compenents, not built-in elements like div
			if (!requiredType && isCustomComponent) {
				// Warning for boolean attributes without initializers
				if (isBoolNode) {
					console.warn("Warning: reactivity for boolean attributes without initializers can not yet be determined (attribute \"" + node.getText() + "\"). Please use " + node.getText() + "={true} instead.");
				}
				else throw new Error(""+node.getSourceFile().fileName+": Could not find type for attribute " + node.parent.getText());
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
				if (!positionsData.positions.has(sourceFile.fileName)) positionsData.positions.set(sourceFile.fileName, []);
				positionsData.positions.get(sourceFile.fileName)!.push(positionsData.attrIndex);
				if (this.#typeChecker.typeToString(requiredType!) == "unknown") {
					console.error("Error: unknown type at " + sourceFile.fileName + ":" + node.pos);
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

