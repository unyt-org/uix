import ts from "npm:typescript";

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
	 * Note: Currently, detectRefMarkers is not supported in deno modules because the type definitions of http modules cannot be resolved.
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
}


export type Positions = {
	file: string,
	pos: number
}[]

export type PositionsData = {
	attrIndex: number,
	positions: Positions
}

export class TSXTypeInferenceGenerator {

	#options: TypeInferenceOptions;
	#compilerOptions: ts.CompilerOptions;
	#watchProgram?: ts.WatchOfFilesAndCompilerOptions<ts.BuilderProgram>;
	#sourcePaths: string[];
	#typeChecker!: ts.TypeChecker;

	static refTypes = ["Ref", "RefLike", "ReactiveValue"];

	constructor(options: TypeInferenceOptions) {
		this.#options = options;

		const paths = this.#options.imports ?
			this.#importMapToPaths(this.#options.imports!, this.#options.importMapPath) :
			{};
		//console.log("paths", paths);

		this.#compilerOptions = {
			jsx: ts.JsxEmit.ReactJSX,
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
		
		// Read the TypeScript file
		this.#sourcePaths = this.#options.sourcePaths.map((sourcePath) => {
			if (sourcePath instanceof URL) return sourcePath.pathname;
			else return sourcePath;
		});
		
		if (this.#options.watch) {
			const host = ts.createWatchCompilerHost(
				this.#sourcePaths, 
				this.#compilerOptions, 
				ts.sys,
				undefined, // Default compiler host
				() => {}, // Empty diagnostic reporter (no logging)
				() => {}  // Empty watch status reporter (no logging)
			);

			this.#watchProgram = ts.createWatchProgram(host);
		}
	}

	/**
	 * Finds all code positions of JSX attribute assignments that require reactive updates
	 * Reactivity is determined by the presence of a special #__ref__ marker property in the type of the attribute
	 * 
	 * @returns Array with file paths and positions 
	 */
	public getReactivePositions(): Positions {
		const positions: Positions = [];

		const program = this.#watchProgram ?
			this.#watchProgram.getProgram().getProgram() :
			ts.createProgram(this.#sourcePaths, this.#compilerOptions);
		this.#typeChecker = program.getTypeChecker();

		program.getSourceFiles().forEach((sourceFile) => {
			// skip non-tsx files
			if (sourceFile.languageVariant !== ts.LanguageVariant.JSX) return;
			//console.log("\nSearching " + sourceFile.fileName);

			const positionsData: PositionsData = { attrIndex: 0, positions: positions };

			this.#visit(sourceFile, positionsData);
		});
		return positions;
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

	#visitAttribute(node: ts.Node, isBoolNode: boolean, positionsData: PositionsData) {

		if (ts.isJsxExpression(node) || ts.isStringLiteral(node) || isBoolNode) {

			const requiredType = this.#typeChecker.getContextualType(node as ts.Expression);
			const isCustomComponent = /[A-Z]/.test((node.parent?.parent as ts.JsxOpeningElement).tagName?.getText()[0]);

			// attribute type error/warning - only for custom compenents, not built-in elements like div
			if (!requiredType && isCustomComponent) {
				// Warning for boolean attributes without initializers
				if (isBoolNode) {
					console.warn("Warning: reactivity for boolean attributes without initializers can not yet be determined (attribute \"" + node.getText() + "\"). Please use " + node.getText() + "={true} instead.");
				}
				else console.error("Error: no type found for node " + positionsData.attrIndex + " in " + node.getSourceFile().fileName);
			}
	
			// if union, iterate over types
			let hasRefMarker = false;
			if (requiredType?.isUnion()) {
				hasRefMarker = requiredType!.types.some((type) => {
					this.#isRef(type)
				});
			}
			else {
				hasRefMarker = requiredType ? this.#isRef(requiredType) : false;
			}
	
			if (hasRefMarker) {
				//console.log(this.#typeChecker.typeToString(requiredType!), node.pos, node.getText());
				// append pos as new line to file
				const sourceFile = node.getSourceFile();
				positionsData.positions.push({ file: sourceFile.fileName, pos: positionsData.attrIndex });
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

