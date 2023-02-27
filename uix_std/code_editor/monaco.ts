import { UIX } from "../../uix.ts";
import { Logger } from "unyt_core/utils/logger.ts";
import { CodeEditor } from "./main.ts";
import { Resource } from "../../uix_all.ts";

const MONACO_VERSION = "0.33.0"

const logger = new Logger("monaco");

type monaco_model = {
    last_saved_state_id,
    uri: {path:string},
    getValue: ()=>string,
    setValue: (string)=>void,
    dispose: ()=>void,
    getLanguageId: ()=>string,
    onDidChangeContent: (listener:Function)=>void,

    // custom properties
    dirty_listeners: Set<Function>,
    error_listeners: Set<Function>,
    code_editors: Set<CodeEditor>,
    new_file_just_opened: boolean,
    resource: Resource
}

const monaco_style_sheet_css = await (await fetch("https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/"+MONACO_VERSION+"/min/vs/editor/editor.main.css")).text();

export default class MonacoHandler {

    static models = new Map<Resource, monaco_model>();

    static monaco;
    static js_worker;
    static ts_worker;

    static initializing = false;
    static init_resolve:Function
    static init_promise = new Promise(resolve=>this.init_resolve = resolve);

    static current_theme_mode = Datex.Value.collapseValue(UIX.Theme.mode, true, true);

    // monaco stylesheets
    private static _editor_stylesheet:CSSStyleSheet
    private static _standalone_stylesheet:CSSStyleSheet

    static get stylesheet() {
        if (!this._editor_stylesheet) {
            this._editor_stylesheet = new window.CSSStyleSheet();
            this._editor_stylesheet.replaceSync(monaco_style_sheet_css);
        }
        return this._editor_stylesheet;
    }

    static get standalone_stylesheet(){
        if (!this._standalone_stylesheet) {
            this._standalone_stylesheet = new window.CSSStyleSheet();
            this._standalone_stylesheet.replaceSync((<HTMLStyleElement>document.querySelector(".monaco-colors"))?.innerText??"");
        }
        return this._standalone_stylesheet;
    } 


    static async setThemeMode(theme:"dark"|"light") {
        this.current_theme_mode = Datex.Value.collapseValue(theme, true, true);
        if (!this.monaco) await this.init();
        this.monaco.editor.setTheme("uix-"+theme);
    }

    // syntax highlighting
    static async colorize(text:string, language:string){
        if (!this.monaco) await this.init();
        let res = this.monaco.editor.colorize(text, language);
        return res;
    }

    static async loadRequireJS(){
        if(window["require"]) return;
        return new Promise<void>(resolve =>{
            var script = document.createElement('script');
            script.onload = function () {
                resolve();
            };
            script.src = "https://cdn.unyt.org/uix/uix_std/code_editor/vs/loader.js";
            document.head.appendChild(script);
        })
    }
    static async getMonaco(){
        if (MonacoHandler.monaco) return;

        await this.loadRequireJS();

        return new Promise<void>(resolve => {

            // @ts-ignore
            require.config({ 
                paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/'+MONACO_VERSION+'/min/vs' },
                'vs/css': { disabled: true }
            });

            
            // TODO renable local path ? if CORS is working
            // @ts-ignore
            //require.config({ paths: { vs: 'https://cdn.unyt.org/uix/uix_std/code_editor/vs' } });


            // @ts-ignore
            require(["vs/editor/editor.main"], () => {
                // @ts-ignore
                MonacoHandler.monaco = monaco;
                resolve();
            });

        })
    }

    // TODO don't just handle monaco models, also: image files + editors, ...!!
    static async updateModelPath(resource:Resource) {
        let editor_instances = (await MonacoHandler.getModel(resource))?.code_editors;
        MonacoHandler.unloadFile(resource, false);
        for (let editor of editor_instances??[]) {
            editor.loadFile(resource);
        }
    }

    // call when a resource was renamed, returns a new model
    static handleModelResourceRename(oldModel) {

        const resource = oldModel.resource;
        if (!resource) {
            logger.error("no resource found for model");
            return;
        }

        const newUri = MonacoHandler.monaco.Uri.parse(resource.path)

        const newModel = MonacoHandler.monaco.editor.createModel(
          oldModel.getValue(),
          oldModel.getLanguageIdentifier().language,
          newUri,
        )
      
        const fsPath = newUri.fsPath // \\filename
        const formatted = newUri.toString() // file:///filename
      
        const editStacks = oldModel._commandManager._undoRedoService._editStacks
      
        const newEditStacks = new Map()
      
        function adjustEditStack(c) {
          c.actual.model = newModel
          c.resourceLabel = fsPath
          c.resourceLabels = [fsPath]
          c.strResource = formatted
          c.strResources = [formatted]
        }
      
        editStacks.forEach((s) => {
          s.resourceLabel = fsPath
          s.strResource = formatted
      
          s._future.forEach(adjustEditStack)
          s._past.forEach(adjustEditStack)
      
          newEditStacks.set(formatted, s)
        })
      
        newModel._commandManager._undoRedoService._editStacks = newEditStacks
        oldModel.dispose()

        newModel.resource = resource;
        newModel.dirty_listeners = oldModel.dirty_listeners
        newModel.error_listeners = oldModel.error_listeners
        newModel.code_editors = oldModel.code_editors
        newModel.new_file_just_opened = oldModel.new_file_just_opened;

        MonacoHandler.models.set(resource, newModel)

        return newModel
    }

    // cache not-reachable files (temporary) TODO remove or improve
    static invalid_resources = new Set<Resource>();

    /**
     * get the monaco model for a file - creates new model if not exists;
     * set file_tree to null if it should be ignored (you are confident that the model still exists, although it was deleted from the file tree)
     */
    static async getModel(resource:Resource): Promise<monaco_model> {
        await MonacoHandler.init();

        // check if exists
        if (this.invalid_resources.has(resource)) {
            logger.error("file "+ resource +" does not exist");
            return null;
        }

        if (MonacoHandler.models.has(resource)) {
            // console.log("model for " + path + " already exists");
            return MonacoHandler.models.get(resource);
        }
        else {

            for (let m of MonacoHandler.monaco.editor.getModels()) {
                if (m.uri.path === resource) {
                    logger.success("FOUND model", resource);
                    return m;
                }
            }

            // set content
            let content:string;
            try {
                // timeout after 3s
                content = await Promise.race([
                    <Promise<string>>(async ()=> <string>new TextDecoder().decode(await resource.value))(), 
                    <Promise<string>>new Promise((resolve, reject)=>setTimeout(()=>{reject()}, 3000))
                ]);
            } catch (e) {
                logger.error("Error getting file " + resource.path, e);
                this.invalid_resources.add(resource);
                return;
            }

            let model:monaco_model;
            try {
                model = MonacoHandler.monaco.editor.createModel(content || "", null, MonacoHandler.monaco.Uri.parse(resource.path));
            }
            catch (e) {
                console.error("MODEL LOADING ERROR", resource.path, e);
                return null;
            }

            // on content changed TODO don't get updates back from server when self changed
            resource.listenForUpdates(async ()=>{
                let model = MonacoHandler.models.get(resource); // get model again (could have changed in the meantime)
                if (!model) {
                    logger.error("resource update: no model for " + resource.path + " found");
                    return;
                }
                logger.info("resource update: " + resource.path);
                
                let new_value = new TextDecoder().decode(await resource.value);
                // set new value if content changed
                if (model.getValue() != new_value) model.setValue(new_value)
            })

            MonacoHandler.models.set(resource, model);

            model.dirty_listeners = new Set<()=>void>();
            model.error_listeners = new Set<()=>void>();

            model.code_editors = new Set<CodeEditor>();

            model.new_file_just_opened = true;

            model.resource = resource;

            // dirty listeners not yet initialised for this model
            if (!model.last_saved_state_id) {
                await this.initListeners(model);
            }

            // try loading missing dependencies
            let dependencies = [...model.getValue().matchAll(/(^|;| |\(|{|=)import[^"']*(?<path>"[^"]*"|'[^']*'|`[^`]*`)/gm)].map(r=>r[2].replace(/['"`]/g,""))

            // logger.info("found dependencies:", dependencies);

            let solved_dependency_errors = 0;
            for (let dep of dependencies) {
                solved_dependency_errors += (await this.handleMissingDependency(resource, dep, model) ? 1 : 0);
            }
            if (solved_dependency_errors>0) logger.success("pre-solved " + solved_dependency_errors + " dependency errors");

            this.updateModelContent(model, content);

            return model;
        }

    }

    private static async initListeners(model){
        MonacoHandler.setSaved(model);
        model.onDidChangeContent(()=>this.checkDirty(model))

        // typescript errors
        if (model.getLanguageId()=="typescript") {
            if(!this.ts_worker) this.ts_worker = await MonacoHandler.monaco.languages.typescript.getTypeScriptWorker();
            model.proxy = await this.ts_worker(model.uri)
            model.onDidChangeDecorations(() => this.checkErrors(model))
        }

        // javascript errors
        else if (model.getLanguageId()=="javascript") {
            if(!this.js_worker)  this.js_worker = await MonacoHandler.monaco.languages.typescript.getJavaScriptWorker();
            model.proxy = await this.js_worker(model.uri)
            model.onDidChangeDecorations(() => this.checkErrors(model))
        }

        // css,json errors
        else if (model.getLanguageId()=="css" || model.getLanguageId()=="json") {
            model.onDidChangeDecorations(() => this.checkErrors(model))
        }
    }

    private static async checkErrors(model) {

        // proxy for js, ts
        if (model.proxy) {
            let syntax_errors = await model.proxy.getSyntacticDiagnostics(model.uri._formatted);
            let semantic_errors = await model.proxy.getSemanticDiagnostics(model.uri._formatted);
            model.error_count = syntax_errors.length + semantic_errors.length;

            let solved_dependency_errors = 0;
            for (let error of semantic_errors) {
                if ( (typeof error.messageText == "string" && error.messageText.startsWith("Cannot find module "))
                    // messageText.messageText ? wtf?
                    || (typeof error.messageText?.messageText == "string" && error.messageText.messageText.startsWith("Cannot find module "))) {

                    // npm dependency
                    if (!error.messageText.includes("/")) {
                        let module = (<string>error.messageText)
                            .substring(0, error.messageText.length - 1)
                            .replace("Cannot find module", "")
                            .replace("or its corresponding type declarations", "")
                            .replace(/'/g, "")
                            .trim();
                        logger.warn("missing npm module '" + module + "'");
                    }
                    // file module dependency
                    else {
                        let path = (<string>error.messageText)
                            .substring(0, error.messageText.length - 1)
                            .replace("Cannot find module", "")
                            .replace("or its corresponding type declarations", "")
                            .replace(/'/g, "")
                            .trim();
                        solved_dependency_errors += (this.handleMissingDependency(model.resource, path, model) ? 1 : 0);
                    }
                }
            }

            // workaround to update error decorators after dependencies were loaded
            if (model.new_file_just_opened) {
                model.new_file_just_opened = false;
                if (solved_dependency_errors>0){
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

        // error count for css, ...
        else  {
            model.error_count = model.getAllDecorations().filter(m=>m.options.className=="squiggly-error").length;

            for (let l of model.error_listeners) {
                l(model.error_count);
            }
        }

    }

    private static async handleMissingDependency(resource:Resource, dependency_path:string, model): Promise<boolean> {
        let absolute_path = ""
        if (!resource.parent) console.warn("no parent", resource)

        if (dependency_path.startsWith("./")) {
            absolute_path = (resource.parent?.path??'') + dependency_path.substring(1, dependency_path.length);
        }
        else if (dependency_path.startsWith("..å/")) {
            let root = resource.parent;
            console.log("ROOT>>>>",root)
            while (dependency_path.startsWith("../")) {
                root = root?.parent;
                dependency_path = dependency_path.substring(3);
            }
            absolute_path = root?.path??"" + "/" + dependency_path;
        }

        if (!absolute_path.match(/\/?[^\/]+\.[^\/]+$/)) absolute_path += ".ts";

        // logger.info("loading dependency", absolute_path);

        if (absolute_path.endsWith(".ts")) {
            let ts_path = Resource.get(absolute_path.replace(/\.js$/, ".ts"))
            // logger.info("loading dependency", ts_path);
            await this.getModel(ts_path)
        }

        return (await this.getModel(Resource.get(absolute_path))) ? true : false;
    }


    private static checkDirty(model){
        if (!model) return;
        model.is_dirty = (model.last_saved_state_id !== model.getAlternativeVersionId())

        for (let l of model.dirty_listeners) {
            l(model.is_dirty);
        }
    }

    public static async getFileContent(resource: Resource) {
        let model = await this.getModel(resource)
        if (model){
            return model.getValue();
        }
    }

    public static async createCompiledJsFile(model) {
        let uri = model.uri;
        let path = uri.path;

        const result = (await model.proxy.getEmitOutput(uri.toString()))?.outputFiles[0];

        let js_resource = Resource.get(result.name)//result.name.replace("file://", "")

        if (!model.file_tree.pathExists(js_resource)) {
            //let res = await FileHandler.addFile(js_resource);
            // TODO create js file
            logger.info("created js file");
        }

        let js_model = await this.getModel(js_resource);

        if (js_model){
            this.updateModelContent(js_model, result.text);
            await this.saveFile(js_model);
        }
    }

    public static setSaved(model) {
        if (!model) return;
        model.last_saved_state_id = model.getAlternativeVersionId()
        MonacoHandler.checkDirty(model);
    }

    public static async saveFile(model){
        model.resource.setValue(model.getValue());
        this.setSaved(model)
    }

    static async unloadFile(path, remove_code_editors = true) {
        logger.info("unloading file " + path + " from monaco models");
        if (remove_code_editors) {
            let editor_instances = (await MonacoHandler.getModel(path))?.code_editors;
            for (let editor of editor_instances??[]) editor.remove();
        }

        this.models.get(path)?.dispose()
        this.models.delete(path)
    }

    static async updateFileContent(path, content:string) {
        let model = await this.getModel(path);
        return this.updateModelContent(model, content);
    }


    static async updateModelContent(model:monaco_model, content?:string) {
        model.setValue(content ?? model.getValue())
        this.setSaved(model)
    }

    /**
     * add a new language definition for monaco
     * tokenizer: {root:[ [/regex1/, 'token1'], [/regex2/, 'token2'] ]} - tokens are e.g. string, number, ...
     */
    static defineLanguage(name:string, extensions:string[] = [], tokenizer?:object, configuration?:object) {
        //logger.info("adding new language:", name)
        MonacoHandler.monaco.languages.register({ id: name, extensions: extensions });
        if (tokenizer) MonacoHandler.monaco.languages.setMonarchTokensProvider(name, {tokenizer: tokenizer});
        if (configuration) MonacoHandler.monaco.languages.setLanguageConfiguration(name, configuration)
    }



    static async addDatexProtocolLanguage(){

        // https://microsoft.github.io/monaco-editor/monarch.html
        await this.defineLanguage("datex", ["dx"], {
                root: [
                    [/^#!.*/, "comment"], // shebang

                    [/\:\:(\:)?/, "source"], // :: :::

                    [/[A-Za-z0-9À-ž_-]* *\:\=/, "source"], // :=

                    [/\.\.?\/(?:[-a-zA-Z0-9(@:%_\+.~#?&//=]|\\.)+/, "path"], // relative path
                    [/[a-zA-Z0-9_]+:\/\/((?:[-a-zA-Z0-9(@:%_\+.~#?&//=]|\\.)+)/, "path"], // url

                    [/\.\.\./, "source"], // ...
                    [/\.\./, "source"], // ..

                    [/0x[0-9a-fA-F_]+/, "number"],
                    [/0b[01_]+/, "number"],
                    [/0o[0-7_]+/, "number"],
                    [/(((\d_?)+\.)?(\d_?)+((E|e)(-|\+)?(\d_?)+)|(\d_?)+\.(\d_?)+)(?! *\:)/, "number", "@unit"], // /((-|\+)?((\d_?)*\.)?(\d_?)*((E|e)(-|\+)?(\d_?)+)|(-|\+)?(\d_?)+\.(\d_?)+)(?! *\:)/
                    [/\b(\d_?)+(?! *\:)/, "number", "@unit"],

                    [/~((\d{1,5}-\d{1,2}-\d{1,2})|(\d{1,5}-\d{1,2}-\d{1,2}(T| )\d{1,2}:\d{1,2}(:\d{1,2}(.\d{1,3})?)?Z?)|(\d{1,2}:\d{1,2}(:\d{1,2}(.\d{1,3})?)?))~/, "time"], // time

                    //[/\!/, "error"],
                    [/<(std:)?[^<>]*Error>/, "error"],

                    [/#[A-Za-z0-9À-ž_]+/, "key"], // internal variable

                    [/\./, "source", "@path"], // path
                    [/\-\>/, "source", "@path"], // path
                    //[/\:/, "source", "@path"], // path

                   // [/[{}]/, "error"],


                    [/[A-Za-z0-9À-ž_-]+?\s*(?=\:)(?!\:\:)/, "key"], //  "string"  x:

                    [/\binfinity\b/, "number"], // infinity

                    [/(##+ +|##+)/, "comment", "@comment"], // ### ###
                    [/\/\*/, "comment", "@comment2"], // ### ###
                    [/╔/, "comment", "@comment3"], // ### ###


                    
                    [/\bnan\b/, "number"], // nan

                    [/\@\@([A-Fa-f0-9_-]{2,36}|local|any)/, { token: 'idendpoint'}], // :lookahead (not working with monaco):  (?<=@.*?:*)[A-Za-zÀ-ž-_]{1,42}(?!.*:)
                    [/\@[A-Za-z0-9À-ž-_]{1,18}/, { token: 'alias'}], // lookahead (not working with monaco):  (?<=@.*?:*)[A-Za-zÀ-ž-_]{1,42}(?!.*:)
                    [/\@\+[A-Za-z0-9À-ž-_]{1,18}/, { token: 'alias-2'}], // lookahead (not working with monaco):  (?<=@.*?:*)[A-Za-zÀ-ž-_]{1,42}(?!.*:)
                    [/\@/, { token: 'idendpoint', next: '@endpoint'}], // lookahead (not working with monaco):  (?<=@.*?:*)[A-Za-zÀ-ž-_]{1,42}(?!.*:)

                    // /\@[A-Za-z0-9À-ž-_]{1,32}(\:[A-Za-z0-9À-ž-_]{1,32})*(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?
                    [/\§[A-Za-zÀ-ž_][A-Za-z0-9À-ž-_]{0,17}(\/(\*|[A-Za-z0-9À-ž-_]{1,8}))?/, "flag"],


                    //[/->/, "key"],
                    //[/\!(\w|\.)+/, "error"],
                    [/\b(true|false)\b/, "boolean"],
                    //[/\b(print|read|debug|printf|current|sender|global|signed|encrypted|timestamp)\b/, "keyword"],
                    [/\b(clone_collapse|response|collapse|named|default|scope|run|export|as|from|var|val|ref|const|new|to|iterator|skip|leave|defer|accept|try|yeet|next|keys|has|iterate|assert|matches|freeze|seal|function|do|await|get|base|transaction|debugger|extends|implements|constructor|destructor|creator|replicator|template|return|exit|use|delete|count|about|if|else|while|origin|copy|clone|type|subscribers|always)\b/, "call"],

                    [/(jmp|jtr|jfa) +/, "call", "@jmp"],
                    [/lbl +/, "call", "@lbl"],

                    [/insert\b/, "insert"],
                    [/compile\b/, "insert"],

                    [/\bnull\b/, "boolean"], // null
                    [/\bvoid\b/, "boolean"], // void
                    [/[A-Za-z_][A-Za-z0-9À-ž_]*/, "terminator"], // variable

                    [/\<\</, "terminator"], // << stream

                    // [/\/.*?(?<!\\)\//, "boolean"], // regex
                    // [/(?<!(@\+?[A-Za-z0-9][A-Za-z0-9À-ž-_.]*))\/(\*|[A-Za-z0-9]+)/, "instance"],
                    //[/[\[\]&|!]/, "filter-element"],
                    [/<(?:(\w+?):)?([A-Za-z0-9À-ž_+-]+)(\/[A-Za-z0-9À-ž_+-]*)*/, "pointer", "@extended_type"],

                    //[/<(?:(\w+?):)?([A-Za-z0-9À-ž_+-]+?)(\/[A-Za-z0-9À-ž_+-]*)*?>/, "pointer"],
                    [/\$\$/, "call"], // $$
                    [/\$((?:[A-Fa-f0-9]{2}|[xX]([A-Fa-f0-9])){1,26})/, "call"], // $aaeeff pointer

                    [/\$([A-Za-z0-9À-ž_]{1,25})/, "call"], // pointer label

                    //[/(\$|\%)(?=\()/, "call"], // $() %()
                    //[/\\/, "call"], // \


                    [/\?\d*/, "insert"],
                    [/`([A-Fa-f0-9_]*)`/, "encrypted"], // buffer
                    //[/[{}]/, "json"],
                    [/[()]/, "terminator"],
                    // match "key": if ':' present
                    //[/("(?:.*?[^\\])??(?:(?:\\\\)+)?")( *\:(?!:))?/, { cases: {'$2': 'key', '@default': {'token':'@rematch', 'next':'@__string1'} }}],
                    //[/('(?:.*?[^\\])??(?:(?:\\\\)+)?')( *\:(?!:))?/, { cases: {'$2': 'key', '@default': {'token':'@rematch', 'next':'@__string2'} }}],
                    //[/("(.|\n)*?(?<![^\\]\\)"|'(.|\n)*?(?<![^\\]\\)('|{)|}(.|\n)*?(?<![^\\]\\)('|{))/, "string"],
                    

                    // multiline strings:
                    [/"/, "string", "@string1"],
                    [/'/, "string", "@string2"],

               
                    [/;/, "terminator"],
                    [/# .*?$/, "comment"],
                    [/\/\/.*?$/, "comment"],
                ],

                unit: [
                    [/((?:[YZEPTGMkhdcmµunpfazy]?[A-Za-z€¢$¥Ω£₽⁄⁄]{1,4}(?:\^-?\d{1,4})?)(?:[*\/][YZEPTGMkhdcmµunpfazy]?[A-Za-z€¢$%¥Ω£₽]{1,4}(?:\^-?\d{1,4})?)*)/, 'unit', '@pop'],
                    [/\d/, "number"],
                    [/./, {'token':'@rematch', 'next':'@pop'}],
                ],

                alias: [
                    [/\:(\:)+/, {'token':'@rematch', 'next':'@pop'}],
                    [/\//, {'token':'key','next':'@alias_instance'}],
                    [/\:/, {'token':'key','next':'@alias_sub'}],
                    [/./, {'token':'@rematch', 'next':'@pop'}],
                ],
                alias_sub: [
                    [/[A-Za-z0-9À-ž-_]{1,32}/, {'token':'alias-light', 'next':'@pop'}],
                    [/\*/, 'boolean', '@pop'], // wildcard (*)
                ],
                alias_instance: [
                    [/[A-Za-z0-9À-ž-_]{1,32}/, {'token':'alias-light', 'next':'@pop'}],
                    [/\*/, 'boolean', '@pop'], // wildcard (*)
                ],

                alias2: [
                    [/\:(\:)+/, {'token':'@rematch', 'next':'@pop'}],
                    [/\//, {'token':'key','next':'@alias2_instance'}],
                    [/\:/, {'token':'key','next':'@alias2_sub'}],
                    [/./, {'token':'@rematch', 'next':'@pop'}],
                ],
                alias2_sub: [
                    [/[A-Za-z0-9À-ž-_]{1,32}/, {'token':'alias-2-light', 'next':'@pop'}],
                    [/\*/, 'boolean', '@pop'], // wildcard (*)
                ],
                alias2_instance: [
                    [/[A-Za-z0-9À-ž-_]{1,32}/, {'token':'alias-2-light', 'next':'@pop'}],
                    [/\*/, 'boolean', '@pop'], // wildcard (*)
                ],

                endpoint_id: [
                    [/\:(\:)+/, {'token':'@rematch', 'next':'@pop'}],
                    [/\//, {'token':'key','next':'@endpoint_id_instance'}],
                    [/\:/, {'token':'key','next':'@endpoint_id_sub'}],
                    [/\*/, 'boolean'], // wildcard (*)
                    [/./, {'token':'@rematch', 'next':'@pop'}],
                ],
                endpoint_id_sub: [
                    [/[A-Za-z0-9À-ž-_]{1,32}/, {'token':'idendpoint-light', 'next':'@pop'}],
                    [/\*/, 'boolean', '@pop'], // wildcard (*)
                ],
                endpoint_id_instance: [
                    [/[A-Za-z0-9À-ž-_]{1,32}/, {'token':'idendpoint-light', 'next':'@pop'}],
                    [/\*/, 'boolean', '@pop'], // wildcard (*)
                ],

                endpoint: [
                    [/\*/, 'boolean'], // wildcard (*)
                    [/./, {'token':'@rematch', 'next':'@pop'}],
                ],

                comment: [
                    [/\\\(/, 'comment.content'],
                    [/\(/, 'delimiter.bracket', '@string_bracket'],
                    [/##+(?! )/, 'comment', '@pop'], // SAFARI does not support negative lookbehind: [/(?<!#)###/, 'comment', '@pop'],
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
                    [/\s*\*(?!\+?[A-Za-zÀ-ž_])/, 'boolean', '@pop'], // wildcard (*)
                    [/[A-Za-zÀ-ž_][A-Za-z0-9À-ž_]*/, "key", '@pop'], // 'string' property (without quotes)
                    [/\s/, 'string', '@pop'],  // whitespace
                    [/\S/,  {'token':'@rematch', 'next':'@pop'}],  // all other property values (was /./ previously)
                ],
                jmp: [
                    [/[0-9A-Fa-f]+\b/, 'call', '@pop'],
                    [/\w+/, 'lbl', '@pop']
                ],
                lbl: [
                    [/\w+/, 'lbl', '@pop']
                ],
                // <()> type
                extended_type: [
                    [/>/, 'pointer', '@pop'],
                    [/\(/, 'delimiter.bracket', '@string_bracket'],
                ],
                // "" strings
                string1: [
                    [/\\\\/, 'string'],
                    [/\\"/, 'string'],
                    [/"/, 'string', '@pop'],
                    [/./, 'string.content']
                ],
                // '' string
                string2: [
                    [/\\\\/, 'string'],
                    [/\\'/, 'string'],
                    [/\\\(/, 'string'],

                    [/'/, 'string', '@pop'],
                    [/\(/, 'delimiter.bracket', '@string_bracket'],
                    [/./, 'string.content']
                ],
                // handle {} brackets inside '' string
                string_bracket: [
                    [/\(/, 'delimiter.bracket', '@string_bracket'],
                    [/\)/, 'delimiter.bracket', '@pop'],
                    { include: 'root' }
                ]
        }, {
            "surroundingPairs":[{"open":"{","close":"}"}, {"open":"[","close":"]"}, {"open":"(","close":")"}, {"open":"###","close":"###"}],
            "autoClosingPairs":[{"open":"'","close":"'"}, {"open":"\"","close":"\""}, {"open":"{","close":"}"}, {"open":"[","close":"]"}, {"open":"(","close":")"}],

            "brackets":[["{","}"], ["[","]"], ["(",")"]],
            "defaultToken": "invalid"
        });
    }
    

    static async _useEspruinoScope(){

        let espruino_definitions = await (await fetch('https://cdn.unyt.org/uix/uix_std/espruino/espruino.d.js')).text()

        // todo setExtraLibs each time an editor is focused to add espruino lib only where required??
        MonacoHandler.monaco.languages.typescript.typescriptDefaults.addExtraLib(`
              import * as ts from './typescript';
              
              declare global { 
                 ${espruino_definitions}
              }

              export as namespace typescript;
            `, 'global.d.ts');
    }

    static async registerReferenceProvider(){

        MonacoHandler.monaco.languages.registerReferenceProvider("typescript", {
            provideReferences: (model, position, context, token) => {
                console.warn(model, position ,context, token)
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
        })
    }


    static async init(){

        if (MonacoHandler.monaco) return;
        
        // wait for other init call to finish
        if (this.initializing) {
            await this.init_promise;
            return;
        }
        this.initializing = true;

        await this.getMonaco();

        const dark_theme = await (await fetch('https://cdn.unyt.org/uix/uix_std/code_editor/themes/DARK.json')).json()
        const light_theme = await (await fetch('https://cdn.unyt.org/uix/uix_std/code_editor/themes/LIGHT.json')).json()

        MonacoHandler.monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: MonacoHandler.monaco.languages.typescript.ScriptTarget.ES2020,
            allowNonTsExtensions: true,
            module: MonacoHandler.monaco.languages.typescript.ModuleKind.ESNext,
            experimentalDecorators: true,
            moduleResolution: MonacoHandler.monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            // noEmit: true,
            typeRoots: ["node_modules/@types"]
        });

        MonacoHandler.monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false
        })


        // extra libraries

        // MonacoHandler.monaco.languages.typescript.typescriptDefaults.addExtraLib(`
        //       import * as ts from './typescript';
        //
        //       declare global {
        //         const lölz = 2342
        //       }
        //
        //       export as namespace typescript;
        //     `, 'global.d.ts');

        // TODO relative paths

        MonacoHandler.monaco.languages.typescript.typescriptDefaults.addExtraLib(
            `export default function helloWorld(a:number, b:string){
                     console.log("a",a);
                     return "12345";
                 }
                                  
            `,  '/otto/appl_game_cool/espruino/test.ts');

        MonacoHandler.monaco.languages.typescript.typescriptDefaults.addExtraLib(
            `export function sync(target: any, name?: string) {}
                 export function sync_as(_: string|Function) {return (target: any, name?: string)=>{}}
                
                 export function sealed(target: any, name: string, _method?) {}
                 export function local(target: any, name: string, _method?) {}
                 export function each(target: any, name: string, _method?) {}
                 export function ease(target: any, name: string, _method?) {}
                                  
            `,  '../unytlib-web/defaults/mentos.d.ts');

        MonacoHandler.monaco.languages.typescript.typescriptDefaults.addExtraLib(
            `export function send(target: any, name?: string) {}
                 export function receive(target: any, name: string, _method?) {}
                 export function station(...station_types: STATION_TYPE[]) {return (target: any) => {}}
                
            `,  '../unytlib-web/defaults/datex.d.ts');

        MonacoHandler.monaco.languages.typescript.typescriptDefaults.addExtraLib(
            `let unyt = new Unyt();
                 export default unyt;

            `,
            '../unytlib-web/defaults/unyt/index.d.ts');

        // TODO: these is the right decorator style! -> add this tokenizer to the monaco source code (locally) (not working here)
        // MonacoHandler.monaco.languages.setMonarchTokensProvider('typescript', {
        //     tokenizer: {
        //         root: [
        //             [/@\s*[a-zA-Z_$][\w$]*/, { token: 'annotation'}]
        //         ]
        //     }
        // });


        MonacoHandler.monaco.editor.defineTheme('uix-dark', dark_theme);
        MonacoHandler.monaco.editor.defineTheme('uix-light', light_theme);

        MonacoHandler.monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

        await this.addDatexProtocolLanguage();
        //this._useEspruinoScope(); // test
        this.registerReferenceProvider();

        // set theme and update on theme change
        MonacoHandler.setThemeMode(this.current_theme_mode)
        UIX.Theme.onModeChange((theme)=>MonacoHandler.setThemeMode(theme))


        // make sure .monaco-colors is loaded (only needed to copy .monaco-colors style into shadow dom)
        await this.colorize("","javascript");

        this.init_resolve();
    }

    static async createTab(div:HTMLElement, code_editor:CodeEditor, editable= true) {
        await MonacoHandler.init();
        return new MonacoTab(div, code_editor, editable);
    }

}

globalThis.MonacoHandler = MonacoHandler;

// window.onload = ()=>MonacoHandler.init();

export class MonacoTab {


    private model: monaco_model;
    public editor;
    private resource: Resource

    private code_editor: CodeEditor;

    private container:HTMLElement
    private editable: boolean;


    public async loadText(text:string, language?:string, custom_options?:any, extension = "dx") {

        this.model = MonacoHandler.monaco.editor.createModel(text || "", null, MonacoHandler.monaco.Uri.parse("/__dx_local__/"+new Date().getTime() + "_" + Math.round(Math.random()*9999999999999999)+"."+extension));

        this.model.dirty_listeners = new Set();
        this.model.error_listeners = new Set();
        this.model.code_editors = new Set();

        this.editor = MonacoHandler.monaco.editor.create(this.container, {
            model: this.model,
            language: language,
            //value: text,

            // lineNumbers: "off",
            readOnly: !this.editable,
            scrollBeyondLastLine: false,
            fontSize: "14px",
            minimap: {enabled: false},
            renderLineHighlight: false,
            automaticLayout: true,
            glyphMargin: false,
            folding: true,

            dragAndDrop: true,
            cursorBlinking: "smooth",
            contextmenu: false,
            // cursorSmoothCaretAnimation: true,
            mouseWheelZoom: true,
            padding: {bottom:20, top:20},
            showDeprecated: true,
            scrollbar: {
                useShadows:false
            },
            overviewRulerBorder:false,
            ...custom_options
        });
    }

    public async setFile(resource:Resource): Promise<boolean> {

        if (this.resource == resource) return false;

        this.resource = resource;
        
        this.resource.onRename(()=>{
            this.model = MonacoHandler.handleModelResourceRename(this.model);
            this.editor.setModel(this.model);
        })

        this.model = await MonacoHandler.getModel(resource);

        if (!this.model) return false;

        if (!this.editor) {
            this.editor = MonacoHandler.monaco.editor.create(this.container, {
                model: this.model,
                // lineNumbers: "off",
                readOnly: !this.editable,
                scrollBeyondLastLine: false,
                fontSize: "14px",
                minimap: {enabled: false},
                renderLineHighlight: false,
                automaticLayout: true,
                folding: true,

                dragAndDrop: true,
                cursorBlinking: "smooth",
                contextmenu: false,
                // cursorSmoothCaretAnimation: true,
                mouseWheelZoom: true,
                padding: {bottom:20, top:20},
                showDeprecated: true,
                scrollbar: {
                    useShadows:false
                },
                overviewRulerBorder:false,

            });

        }
        else {
            // console.log("... updating existing monaco editor")
            this.editor.setModel(this.model);
        }

        this.model.code_editors.add(this.code_editor)

        return true;

    }



    constructor(container:HTMLElement, code_editor:CodeEditor, editable = true){
        this.container = container
        this.editable = editable;
        this.code_editor = code_editor
    }

    public triggerAction(action:string) {
        this.editor?.getAction('editor.action.' + action).run()
    }

    public focus() {
        this.editor?.focus();
    }

    public getContent(){
        return this.editor?.getValue();
    }

    public async saveFile(){
        await MonacoHandler.saveFile(this.model)
        if (this.model && this.model.getLanguageId()=="typescript") await MonacoHandler.createCompiledJsFile(this.model);
    }


    public addErrorListener(listener:(is_dirty:boolean)=>void){
        this.model?.error_listeners.add(listener)
    }

    public addDirtyListener(listener:(is_dirty:boolean)=>void){
        this.model?.dirty_listeners.add(listener)
    }

    public setScroll(x:number, y:number) {
        this.editor?.setScrollPosition({scrollTop: y, scrollLeft: x});
    }

    public addChangeListener(listener:()=>void){
        this.model?.onDidChangeContent(listener);
    }

    public setScrollListener(listener:(x:number, y:number)=>void) {
        this.editor?.onDidScrollChange(e=>listener(e.scrollLeft, e.scrollTop));
    }


    public setContent(content:string) {
        MonacoHandler.updateModelContent(this.model, content);
    }

}

