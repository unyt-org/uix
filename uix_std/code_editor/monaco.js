import { UIX } from "../../uix.ts";
import { Logger } from "unyt_core/utils/logger.ts";
import { Resource, window } from "../../uix_all.ts";
const MONACO_VERSION = "0.33.0";
const logger = new Logger("monaco");
const monaco_style_sheet_css = await (await fetch("https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/" + MONACO_VERSION + "/min/vs/editor/editor.main.css")).text();
export default class MonacoHandler {
    static models = new Map();
    static monaco;
    static js_worker;
    static ts_worker;
    static initializing = false;
    static init_resolve;
    static init_promise = new Promise(resolve => this.init_resolve = resolve);
    static current_theme_mode = Datex.Value.collapseValue(UIX.Theme.mode, true, true);
    static _editor_stylesheet;
    static _standalone_stylesheet;
    static get stylesheet() {
        if (!this._editor_stylesheet) {
            this._editor_stylesheet = new window.CSSStyleSheet();
            this._editor_stylesheet.replaceSync(monaco_style_sheet_css);
        }
        return this._editor_stylesheet;
    }
    static get standalone_stylesheet() {
        if (!this._standalone_stylesheet) {
            this._standalone_stylesheet = new window.CSSStyleSheet();
            this._standalone_stylesheet.replaceSync(document.querySelector(".monaco-colors")?.innerText ?? "");
        }
        return this._standalone_stylesheet;
    }
    static async setThemeMode(theme) {
        this.current_theme_mode = Datex.Value.collapseValue(theme, true, true);
        if (!this.monaco)
            await this.init();
        this.monaco.editor.setTheme("uix-" + theme);
    }
    static async colorize(text, language) {
        if (!this.monaco)
            await this.init();
        let res = this.monaco.editor.colorize(text, language);
        return res;
    }
    static async loadRequireJS() {
        if (window["require"])
            return;
        return new Promise(resolve => {
            var script = document.createElement('script');
            script.onload = function () {
                resolve();
            };
            script.src = "https://cdn.unyt.org/uix/uix_std/code_editor/vs/loader.js";
            document.head.appendChild(script);
        });
    }
    static async getMonaco() {
        if (MonacoHandler.monaco)
            return;
        await this.loadRequireJS();
        return new Promise(resolve => {
            require.config({
                paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/' + MONACO_VERSION + '/min/vs' },
                'vs/css': { disabled: true }
            });
            require(["vs/editor/editor.main"], () => {
                MonacoHandler.monaco = monaco;
                resolve();
            });
        });
    }
    static async updateModelPath(resource) {
        let editor_instances = (await MonacoHandler.getModel(resource))?.code_editors;
        MonacoHandler.unloadFile(resource, false);
        for (let editor of editor_instances ?? []) {
            editor.loadFile(resource);
        }
    }
    static handleModelResourceRename(oldModel) {
        const resource = oldModel.resource;
        if (!resource) {
            logger.error("no resource found for model");
            return;
        }
        const newUri = MonacoHandler.monaco.Uri.parse(resource.path);
        const newModel = MonacoHandler.monaco.editor.createModel(oldModel.getValue(), oldModel.getLanguageIdentifier().language, newUri);
        const fsPath = newUri.fsPath;
        const formatted = newUri.toString();
        const editStacks = oldModel._commandManager._undoRedoService._editStacks;
        const newEditStacks = new Map();
        function adjustEditStack(c) {
            c.actual.model = newModel;
            c.resourceLabel = fsPath;
            c.resourceLabels = [fsPath];
            c.strResource = formatted;
            c.strResources = [formatted];
        }
        editStacks.forEach((s) => {
            s.resourceLabel = fsPath;
            s.strResource = formatted;
            s._future.forEach(adjustEditStack);
            s._past.forEach(adjustEditStack);
            newEditStacks.set(formatted, s);
        });
        newModel._commandManager._undoRedoService._editStacks = newEditStacks;
        oldModel.dispose();
        newModel.resource = resource;
        newModel.dirty_listeners = oldModel.dirty_listeners;
        newModel.error_listeners = oldModel.error_listeners;
        newModel.code_editors = oldModel.code_editors;
        newModel.new_file_just_opened = oldModel.new_file_just_opened;
        MonacoHandler.models.set(resource, newModel);
        return newModel;
    }
    static invalid_resources = new Set();
    static async getModel(resource) {
        await MonacoHandler.init();
        if (this.invalid_resources.has(resource)) {
            logger.error("file " + resource + " does not exist");
            return null;
        }
        if (MonacoHandler.models.has(resource)) {
            return MonacoHandler.models.get(resource);
        }
        else {
            for (let m of MonacoHandler.monaco.editor.getModels()) {
                if (m.uri.path === resource) {
                    logger.success("FOUND model", resource);
                    return m;
                }
            }
            let content;
            try {
                content = await Promise.race([
                    (async () => new TextDecoder().decode(await resource.value))(),
                    new Promise((resolve, reject) => setTimeout(() => { reject(); }, 3000))
                ]);
            }
            catch (e) {
                logger.error("Error getting file " + resource.path, e);
                this.invalid_resources.add(resource);
                return;
            }
            let model;
            try {
                model = MonacoHandler.monaco.editor.createModel(content || "", null, MonacoHandler.monaco.Uri.parse(resource.path));
            }
            catch (e) {
                console.error("MODEL LOADING ERROR", resource.path, e);
                return null;
            }
            resource.listenForUpdates(async () => {
                let model = MonacoHandler.models.get(resource);
                if (!model) {
                    logger.error("resource update: no model for " + resource.path + " found");
                    return;
                }
                logger.info("resource update: " + resource.path);
                let new_value = new TextDecoder().decode(await resource.value);
                if (model.getValue() != new_value)
                    model.setValue(new_value);
            });
            MonacoHandler.models.set(resource, model);
            model.dirty_listeners = new Set();
            model.error_listeners = new Set();
            model.code_editors = new Set();
            model.new_file_just_opened = true;
            model.resource = resource;
            if (!model.last_saved_state_id) {
                await this.initListeners(model);
            }
            let dependencies = [...model.getValue().matchAll(/(^|;| |\(|{|=)import[^"']*(?<path>"[^"]*"|'[^']*'|`[^`]*`)/gm)].map(r => r[2].replace(/['"`]/g, ""));
            let solved_dependency_errors = 0;
            for (let dep of dependencies) {
                solved_dependency_errors += (await this.handleMissingDependency(resource, dep, model) ? 1 : 0);
            }
            if (solved_dependency_errors > 0)
                logger.success("pre-solved " + solved_dependency_errors + " dependency errors");
            this.updateModelContent(model, content);
            return model;
        }
    }
    static async initListeners(model) {
        MonacoHandler.setSaved(model);
        model.onDidChangeContent(() => this.checkDirty(model));
        if (model.getLanguageId() == "typescript") {
            if (!this.ts_worker)
                this.ts_worker = await MonacoHandler.monaco.languages.typescript.getTypeScriptWorker();
            model.proxy = await this.ts_worker(model.uri);
            model.onDidChangeDecorations(() => this.checkErrors(model));
        }
        else if (model.getLanguageId() == "javascript") {
            if (!this.js_worker)
                this.js_worker = await MonacoHandler.monaco.languages.typescript.getJavaScriptWorker();
            model.proxy = await this.js_worker(model.uri);
            model.onDidChangeDecorations(() => this.checkErrors(model));
        }
        else if (model.getLanguageId() == "css" || model.getLanguageId() == "json") {
            model.onDidChangeDecorations(() => this.checkErrors(model));
        }
    }
    static async checkErrors(model) {
        if (model.proxy) {
            let syntax_errors = await model.proxy.getSyntacticDiagnostics(model.uri._formatted);
            let semantic_errors = await model.proxy.getSemanticDiagnostics(model.uri._formatted);
            model.error_count = syntax_errors.length + semantic_errors.length;
            let solved_dependency_errors = 0;
            for (let error of semantic_errors) {
                if ((typeof error.messageText == "string" && error.messageText.startsWith("Cannot find module "))
                    || (typeof error.messageText?.messageText == "string" && error.messageText.messageText.startsWith("Cannot find module "))) {
                    if (!error.messageText.includes("/")) {
                        let module = error.messageText
                            .substring(0, error.messageText.length - 1)
                            .replace("Cannot find module", "")
                            .replace("or its corresponding type declarations", "")
                            .replace(/'/g, "")
                            .trim();
                        logger.warn("missing npm module '" + module + "'");
                    }
                    else {
                        let path = error.messageText
                            .substring(0, error.messageText.length - 1)
                            .replace("Cannot find module", "")
                            .replace("or its corresponding type declarations", "")
                            .replace(/'/g, "")
                            .trim();
                        solved_dependency_errors += (this.handleMissingDependency(model.resource, path, model) ? 1 : 0);
                    }
                }
            }
            if (model.new_file_just_opened) {
                model.new_file_just_opened = false;
                if (solved_dependency_errors > 0) {
                    logger.success("solved " + solved_dependency_errors + " dependency errors");
                    this.updateModelContent(model);
                }
            }
            else {
                for (let l of model.error_listeners) {
                    l(model.error_count);
                }
            }
        }
        else {
            model.error_count = model.getAllDecorations().filter(m => m.options.className == "squiggly-error").length;
            for (let l of model.error_listeners) {
                l(model.error_count);
            }
        }
    }
    static async handleMissingDependency(resource, dependency_path, model) {
        let absolute_path = "";
        if (!resource.parent)
            console.warn("no parent", resource);
        if (dependency_path.startsWith("./")) {
            absolute_path = (resource.parent?.path ?? '') + dependency_path.substring(1, dependency_path.length);
        }
        else if (dependency_path.startsWith("..å/")) {
            let root = resource.parent;
            console.log("ROOT>>>>", root);
            while (dependency_path.startsWith("../")) {
                root = root?.parent;
                dependency_path = dependency_path.substring(3);
            }
            absolute_path = root?.path ?? "" + "/" + dependency_path;
        }
        if (!absolute_path.match(/\/?[^\/]+\.[^\/]+$/))
            absolute_path += ".ts";
        if (absolute_path.endsWith(".ts")) {
            let ts_path = Resource.get(absolute_path.replace(/\.js$/, ".ts"));
            await this.getModel(ts_path);
        }
        return (await this.getModel(Resource.get(absolute_path))) ? true : false;
    }
    static checkDirty(model) {
        if (!model)
            return;
        model.is_dirty = (model.last_saved_state_id !== model.getAlternativeVersionId());
        for (let l of model.dirty_listeners) {
            l(model.is_dirty);
        }
    }
    static async getFileContent(resource) {
        let model = await this.getModel(resource);
        if (model) {
            return model.getValue();
        }
    }
    static async createCompiledJsFile(model) {
        let uri = model.uri;
        let path = uri.path;
        const result = (await model.proxy.getEmitOutput(uri.toString()))?.outputFiles[0];
        let js_resource = Resource.get(result.name);
        if (!model.file_tree.pathExists(js_resource)) {
            logger.info("created js file");
        }
        let js_model = await this.getModel(js_resource);
        if (js_model) {
            this.updateModelContent(js_model, result.text);
            await this.saveFile(js_model);
        }
    }
    static setSaved(model) {
        if (!model)
            return;
        model.last_saved_state_id = model.getAlternativeVersionId();
        MonacoHandler.checkDirty(model);
    }
    static async saveFile(model) {
        model.resource.setValue(model.getValue());
        this.setSaved(model);
    }
    static async unloadFile(path, remove_code_editors = true) {
        logger.info("unloading file " + path + " from monaco models");
        if (remove_code_editors) {
            let editor_instances = (await MonacoHandler.getModel(path))?.code_editors;
            for (let editor of editor_instances ?? [])
                editor.remove();
        }
        this.models.get(path)?.dispose();
        this.models.delete(path);
    }
    static async updateFileContent(path, content) {
        let model = await this.getModel(path);
        return this.updateModelContent(model, content);
    }
    static async updateModelContent(model, content) {
        model.setValue(content ?? model.getValue());
        this.setSaved(model);
    }
    static defineLanguage(name, extensions = [], tokenizer, configuration) {
        MonacoHandler.monaco.languages.register({ id: name, extensions: extensions });
        if (tokenizer)
            MonacoHandler.monaco.languages.setMonarchTokensProvider(name, { tokenizer: tokenizer });
        if (configuration)
            MonacoHandler.monaco.languages.setLanguageConfiguration(name, configuration);
    }
    static async addDatexProtocolLanguage() {
        await this.defineLanguage("datex", ["dx"], {
            root: [
                [/^#!.*/, "comment"],
                [/\:\:(\:)?/, "source"],
                [/[A-Za-z0-9À-ž_-]* *\:\=/, "source"],
                [/\.\.?\/(?:[-a-zA-Z0-9(@:%_\+.~#?&//=]|\\.)+/, "path"],
                [/[a-zA-Z0-9_]+:\/\/((?:[-a-zA-Z0-9(@:%_\+.~#?&//=]|\\.)+)/, "path"],
                [/\.\.\./, "source"],
                [/\.\./, "source"],
                [/0x[0-9a-fA-F_]+/, "number"],
                [/0b[01_]+/, "number"],
                [/0o[0-7_]+/, "number"],
                [/(((\d_?)+\.)?(\d_?)+((E|e)(-|\+)?(\d_?)+)|(\d_?)+\.(\d_?)+)(?! *\:)/, "number", "@unit"],
                [/\b(\d_?)+(?! *\:)/, "number", "@unit"],
                [/~((\d{1,5}-\d{1,2}-\d{1,2})|(\d{1,5}-\d{1,2}-\d{1,2}(T| )\d{1,2}:\d{1,2}(:\d{1,2}(.\d{1,3})?)?Z?)|(\d{1,2}:\d{1,2}(:\d{1,2}(.\d{1,3})?)?))~/, "time"],
                [/<(std:)?[^<>]*Error>/, "error"],
                [/#[A-Za-z0-9À-ž_]+/, "key"],
                [/\./, "source", "@path"],
                [/\-\>/, "source", "@path"],
                [/[A-Za-z0-9À-ž_-]+?\s*(?=\:)(?!\:\:)/, "key"],
                [/\binfinity\b/, "number"],
                [/(##+ +|##+)/, "comment", "@comment"],
                [/\/\*/, "comment", "@comment2"],
                [/╔/, "comment", "@comment3"],
                [/\bnan\b/, "number"],
                [/\@\@([A-Fa-f0-9_-]{2,26}|local|any)/, { token: 'idendpoint' }],
                [/\@[A-Za-z0-9À-ž-_]{1,32}/, { token: 'alias' }],
                [/\@\+[A-Za-z0-9À-ž-_]{1,32}/, { token: 'alias-2' }],
                [/\@/, { token: 'idendpoint', next: '@endpoint' }],
                [/\§[A-Za-zÀ-ž_][A-Za-z0-9À-ž-_]{0,17}(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?/, "flag"],
                [/\b(true|false)\b/, "boolean"],
                [/\b(clone_collapse|response|collapse|named|default|scope|run|export|as|from|var|val|ref|const|new|to|iterator|skip|leave|once|accept|try|yeet|next|keys|has|iterate|assert|matches|freeze|seal|function|do|await|get|base|transaction|debugger|extends|implements|constructor|destructor|creator|replicator|template|return|exit|use|delete|count|about|if|else|while|origin|copy|clone|type|subscribers|always)\b/, "call"],
                [/(jmp|jtr|jfa) +/, "call", "@jmp"],
                [/lbl +/, "call", "@lbl"],
                [/insert\b/, "insert"],
                [/compile\b/, "insert"],
                [/\bnull\b/, "boolean"],
                [/\bvoid\b/, "boolean"],
                [/[A-Za-z_][A-Za-z0-9À-ž_]*/, "terminator"],
                [/\<\</, "terminator"],
                [/<(?:(\w+?):)?([A-Za-z0-9À-ž_+-]+)(\/[A-Za-z0-9À-ž_+-]*)*/, "pointer", "@extended_type"],
                [/\$\$/, "call"],
                [/\$((?:[A-Fa-f0-9]{2}|[xX]([A-Fa-f0-9])){1,26})/, "call"],
                [/\$([A-Za-z0-9À-ž_]{1,25})/, "call"],
                [/\?\d*/, "insert"],
                [/`([A-Fa-f0-9_]*)`/, "encrypted"],
                [/[()]/, "terminator"],
                [/"/, "string", "@string1"],
                [/'/, "string", "@string2"],
                [/;/, "terminator"],
                [/# .*?$/, "comment"],
                [/\/\/.*?$/, "comment"],
            ],
            unit: [
                [/((?:[YZEPTGMkhdcmµunpfazy]?[A-Za-z€¢$¥Ω£₽⁄⁄]{1,4}(?:\^-?\d{1,4})?)(?:[*\/][YZEPTGMkhdcmµunpfazy]?[A-Za-z€¢$%¥Ω£₽]{1,4}(?:\^-?\d{1,4})?)*)/, 'unit', '@pop'],
                [/\d/, "number"],
                [/./, 'key', '@pop'],
            ],
            alias: [
                [/\:(\:)+/, { 'token': '@rematch', 'next': '@popall' }],
                [/\//, { 'token': 'key', 'next': '@alias_instance' }],
                [/\:/, { 'token': 'key', 'next': '@alias_sub' }],
                [/./, { 'token': '@rematch', 'next': '@popall' }],
            ],
            alias_sub: [
                [/[A-Za-z0-9À-ž-_]{1,32}/, { 'token': 'alias-light', 'next': '@pop' }],
                [/\*/, 'boolean', '@pop'],
            ],
            alias_instance: [
                [/[A-Za-z0-9À-ž-_]{1,32}/, { 'token': 'alias-light', 'next': '@popall' }],
                [/\*/, 'boolean', '@popall'],
            ],
            alias2: [
                [/\:(\:)+/, { 'token': '@rematch', 'next': '@popall' }],
                [/\//, { 'token': 'key', 'next': '@alias2_instance' }],
                [/\:/, { 'token': 'key', 'next': '@alias2_sub' }],
                [/./, { 'token': '@rematch', 'next': '@popall' }],
            ],
            alias2_sub: [
                [/[A-Za-z0-9À-ž-_]{1,32}/, { 'token': 'alias-2-light', 'next': '@pop' }],
                [/\*/, 'boolean', '@pop'],
            ],
            alias2_instance: [
                [/[A-Za-z0-9À-ž-_]{1,32}/, { 'token': 'alias-2-light', 'next': '@popall' }],
                [/\*/, 'boolean', '@popall'],
            ],
            endpoint_id: [
                [/\:(\:)+/, { 'token': '@rematch', 'next': '@popall' }],
                [/\//, { 'token': 'key', 'next': '@endpoint_id_instance' }],
                [/\:/, { 'token': 'key', 'next': '@endpoint_id_sub' }],
                [/\*/, 'boolean'],
                [/./, { 'token': '@rematch', 'next': '@popall' }],
            ],
            endpoint_id_sub: [
                [/[A-Za-z0-9À-ž-_]{1,32}/, { 'token': 'idendpoint-light', 'next': '@pop' }],
                [/\*/, 'boolean', '@pop'],
            ],
            endpoint_id_instance: [
                [/[A-Za-z0-9À-ž-_]{1,32}/, { 'token': 'idendpoint-light', 'next': '@popall' }],
                [/\*/, 'boolean', '@popall'],
            ],
            endpoint: [
                [/\*/, 'boolean'],
                [/./, { 'token': '@rematch', 'next': '@popall' }],
            ],
            comment: [
                [/\\\(/, 'comment.content'],
                [/\(/, 'delimiter.bracket', '@string_bracket'],
                [/##+(?! )/, 'comment', '@pop'],
                [/./, 'comment.content']
            ],
            comment2: [
                [/\*\//, 'comment', '@pop'],
                [/./, 'comment.content']
            ],
            comment3: [
                [/╝/, 'comment', '@pop'],
                [/[^╔═╗╚═╝╠╣╦╩║]/, 'string'],
                [/./, 'comment.content']
            ],
            path: [
                [/\s*\*(?!\+?[A-Za-zÀ-ž_])/, 'boolean', '@pop'],
                [/[A-Za-zÀ-ž_][A-Za-z0-9À-ž_]*/, "key", '@pop'],
                [/\s/, 'string', '@pop'],
                [/\S/, { 'token': '@rematch', 'next': '@pop' }],
            ],
            jmp: [
                [/[0-9A-Fa-f]+\b/, 'call', '@pop'],
                [/\w+/, 'lbl', '@pop']
            ],
            lbl: [
                [/\w+/, 'lbl', '@pop']
            ],
            extended_type: [
                [/>/, 'pointer', '@pop'],
                [/\(/, 'delimiter.bracket', '@string_bracket'],
            ],
            string1: [
                [/\\\\/, 'string'],
                [/\\"/, 'string'],
                [/"/, 'string', '@pop'],
                [/./, 'string.content']
            ],
            string2: [
                [/\\\\/, 'string'],
                [/\\'/, 'string'],
                [/\\\(/, 'string'],
                [/'/, 'string', '@pop'],
                [/\(/, 'delimiter.bracket', '@string_bracket'],
                [/./, 'string.content']
            ],
            string_bracket: [
                [/\(/, 'delimiter.bracket', '@string_bracket'],
                [/\)/, 'delimiter.bracket', '@pop'],
                { include: 'root' }
            ]
        }, {
            "surroundingPairs": [{ "open": "{", "close": "}" }, { "open": "[", "close": "]" }, { "open": "(", "close": ")" }, { "open": "###", "close": "###" }],
            "autoClosingPairs": [{ "open": "'", "close": "'" }, { "open": "\"", "close": "\"" }, { "open": "{", "close": "}" }, { "open": "[", "close": "]" }, { "open": "(", "close": ")" }],
            "brackets": [["{", "}"], ["[", "]"], ["(", ")"]],
            "defaultToken": "invalid"
        });
    }
    static async _useEspruinoScope() {
        let espruino_definitions = await (await fetch('https://cdn.unyt.org/uix/uix_std/espruino/espruino.d.js')).text();
        MonacoHandler.monaco.languages.typescript.typescriptDefaults.addExtraLib(`
              import * as ts from './typescript';
              
              declare global { 
                 ${espruino_definitions}
              }

              export as namespace typescript;
            `, 'global.d.ts');
    }
    static async registerReferenceProvider() {
        MonacoHandler.monaco.languages.registerReferenceProvider("typescript", {
            provideReferences: (model, position, context, token) => {
                console.warn(model, position, context, token);
                return new Promise((resolve, reject) => {
                    resolve({
                        uri: "123",
                        range: {
                            startLineNumber: 1,
                            startColumn: 1,
                            endLineNumber: 1,
                            endColumn: 5,
                        }
                    });
                });
            }
        });
    }
    static async init() {
        if (MonacoHandler.monaco)
            return;
        if (this.initializing) {
            await this.init_promise;
            return;
        }
        this.initializing = true;
        await this.getMonaco();
        const dark_theme = await (await fetch('https://cdn.unyt.org/uix/uix_std/code_editor/themes/DARK.json')).json();
        const light_theme = await (await fetch('https://cdn.unyt.org/uix/uix_std/code_editor/themes/LIGHT.json')).json();
        MonacoHandler.monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: MonacoHandler.monaco.languages.typescript.ScriptTarget.ES2020,
            allowNonTsExtensions: true,
            module: MonacoHandler.monaco.languages.typescript.ModuleKind.ESNext,
            experimentalDecorators: true,
            moduleResolution: MonacoHandler.monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            typeRoots: ["node_modules/@types"]
        });
        MonacoHandler.monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false
        });
        MonacoHandler.monaco.languages.typescript.typescriptDefaults.addExtraLib(`export default function helloWorld(a:number, b:string){
                     console.log("a",a);
                     return "12345";
                 }
                                  
            `, '/otto/appl_game_cool/espruino/test.ts');
        MonacoHandler.monaco.languages.typescript.typescriptDefaults.addExtraLib(`export function sync(target: any, name?: string) {}
                 export function sync_as(_: string|Function) {return (target: any, name?: string)=>{}}
                
                 export function sealed(target: any, name: string, _method?) {}
                 export function local(target: any, name: string, _method?) {}
                 export function each(target: any, name: string, _method?) {}
                 export function ease(target: any, name: string, _method?) {}
                                  
            `, '../unytlib-web/defaults/mentos.d.ts');
        MonacoHandler.monaco.languages.typescript.typescriptDefaults.addExtraLib(`export function send(target: any, name?: string) {}
                 export function receive(target: any, name: string, _method?) {}
                 export function station(...station_types: STATION_TYPE[]) {return (target: any) => {}}
                
            `, '../unytlib-web/defaults/datex.d.ts');
        MonacoHandler.monaco.languages.typescript.typescriptDefaults.addExtraLib(`let unyt = new Unyt();
                 export default unyt;

            `, '../unytlib-web/defaults/unyt/index.d.ts');
        MonacoHandler.monaco.editor.defineTheme('uix-dark', dark_theme);
        MonacoHandler.monaco.editor.defineTheme('uix-light', light_theme);
        MonacoHandler.monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
        await this.addDatexProtocolLanguage();
        this.registerReferenceProvider();
        MonacoHandler.setThemeMode(this.current_theme_mode);
        UIX.Theme.onModeChange((theme) => MonacoHandler.setThemeMode(theme));
        await this.colorize("", "javascript");
        this.init_resolve();
    }
    static async createTab(div, code_editor, editable = true) {
        await MonacoHandler.init();
        return new MonacoTab(div, code_editor, editable);
    }
}
globalThis.MonacoHandler = MonacoHandler;
export class MonacoTab {
    model;
    editor;
    resource;
    code_editor;
    container;
    editable;
    async loadText(text, language, custom_options, extension = "dx") {
        this.model = MonacoHandler.monaco.editor.createModel(text || "", null, MonacoHandler.monaco.Uri.parse("/__dx_local__/" + new Date().getTime() + "_" + Math.round(Math.random() * 9999999999999999) + "." + extension));
        this.model.dirty_listeners = new Set();
        this.model.error_listeners = new Set();
        this.model.code_editors = new Set();
        this.editor = MonacoHandler.monaco.editor.create(this.container, {
            model: this.model,
            language: language,
            readOnly: !this.editable,
            scrollBeyondLastLine: false,
            fontSize: "14px",
            minimap: { enabled: false },
            renderLineHighlight: false,
            automaticLayout: true,
            glyphMargin: false,
            folding: true,
            dragAndDrop: true,
            cursorBlinking: "smooth",
            contextmenu: false,
            mouseWheelZoom: true,
            padding: { bottom: 20, top: 20 },
            showDeprecated: true,
            scrollbar: {
                useShadows: false
            },
            overviewRulerBorder: false,
            ...custom_options
        });
    }
    async setFile(resource) {
        if (this.resource == resource)
            return false;
        this.resource = resource;
        this.resource.onRename(() => {
            this.model = MonacoHandler.handleModelResourceRename(this.model);
            this.editor.setModel(this.model);
        });
        this.model = await MonacoHandler.getModel(resource);
        if (!this.model)
            return false;
        if (!this.editor) {
            this.editor = MonacoHandler.monaco.editor.create(this.container, {
                model: this.model,
                readOnly: !this.editable,
                scrollBeyondLastLine: false,
                fontSize: "14px",
                minimap: { enabled: false },
                renderLineHighlight: false,
                automaticLayout: true,
                folding: true,
                dragAndDrop: true,
                cursorBlinking: "smooth",
                contextmenu: false,
                mouseWheelZoom: true,
                padding: { bottom: 20, top: 20 },
                showDeprecated: true,
                scrollbar: {
                    useShadows: false
                },
                overviewRulerBorder: false,
            });
        }
        else {
            this.editor.setModel(this.model);
        }
        this.model.code_editors.add(this.code_editor);
        return true;
    }
    constructor(container, code_editor, editable = true) {
        this.container = container;
        this.editable = editable;
        this.code_editor = code_editor;
    }
    triggerAction(action) {
        this.editor?.getAction('editor.action.' + action).run();
    }
    focus() {
        this.editor?.focus();
    }
    getContent() {
        return this.editor?.getValue();
    }
    async saveFile() {
        await MonacoHandler.saveFile(this.model);
        if (this.model && this.model.getLanguageId() == "typescript")
            await MonacoHandler.createCompiledJsFile(this.model);
    }
    addErrorListener(listener) {
        this.model?.error_listeners.add(listener);
    }
    addDirtyListener(listener) {
        this.model?.dirty_listeners.add(listener);
    }
    setScroll(x, y) {
        this.editor?.setScrollPosition({ scrollTop: y, scrollLeft: x });
    }
    addChangeListener(listener) {
        this.model?.onDidChangeContent(listener);
    }
    setScrollListener(listener) {
        this.editor?.onDidScrollChange(e => listener(e.scrollLeft, e.scrollTop));
    }
    setContent(content) {
        MonacoHandler.updateModelContent(this.model, content);
    }
}
