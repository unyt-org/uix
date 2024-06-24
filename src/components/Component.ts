// deno-lint-ignore-file no-async-promise-executor
import { Datex, property, get} from "datex-core-legacy"
import { logger } from "../utils/global-values.ts"
import { Class, Logger, METADATA, ValueError } from "datex-core-legacy/datex_all.ts"
import { CHILD_PROPS, CONTENT_PROPS, ID_PROPS, IMPORT_PROPS, LAYOUT_PROPS, ORIGIN_PROPS, STANDALONE_PROPS } from "../base/decorators.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { RouteManager } from "../html/entrypoints.ts";
import { Context } from "../routing/context.ts";
import { makeScrollContainer, scrollContext, scrollToBottom, scrollToTop, updateScrollPosition } from "../standalone/scroll_container.ts";
import { OpenGraphInformation, OpenGraphPreviewImageGenerator, OPEN_GRAPH } from "../base/open-graph.ts";
import { bindContentProperties } from "../standalone/bound_content_properties.ts";
import { DX_IGNORE, DX_TYPE, DX_ROOT, INIT_PROPS } from "datex-core-legacy/runtime/constants.ts"
import { PlaceholderCSSStyleDeclaration, addGlobalStyleSheetLink, addStyleSheetLink } from "../utils/css-style-compat.ts";
import { indent } from "datex-core-legacy/utils/indent.ts"
import { serializeJSValue } from "../utils/serialize-js.ts";
import { BOUND_TO_ORIGIN, bindToOrigin, getValueInitializer } from "../app/datex-over-http.ts"
import type { DynamicCSSStyleSheet } from "../utils/css-template-strings.ts";
import { addCSSScopeSelector } from "../utils/css-scoping.ts"
import { jsxInputGenerator } from "../html/template.ts";
import { domContext, domUtils } from "../app/dom-context.ts";
import { UIX } from "../../uix.ts";
import { convertToWebPath } from "../app/convert-to-web-path.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { app } from "../app/app.ts";
import { fileExists } from "../utils/files.ts";
import { DISPOSE_BOUND_PROTOTYPE } from "../standalone/get_prototype_properties.ts";
import { getDeclaredExternalVariables, getDeclaredExternalVariablesAsync } from "datex-core-legacy/types/function-utils.ts";
import { JSTransferableFunction } from "datex-core-legacy/types/js-function.ts";

export type propInit = {datex?:boolean};
export type standaloneContentPropertyData = {type:'id'|'content'|'layout'|'child',id:string};
export type standalonePropertyData = {type:'prop'}
export type standaloneProperties = Record<string, (standaloneContentPropertyData | standalonePropertyData) & {init?:propInit }>;

// deno-lint-ignore no-empty-interface
interface Options {}

// @template("uix:component") 
export abstract class Component<O extends Options = Options, ChildElement = JSX.singleOrMultipleChildren> extends domContext.HTMLElement implements RouteManager {

    /************************************ STATIC ***************************************/

    protected static stylesheets:string[] =  []

    protected static shadow_stylesheets:string[] =  [
        // global base style
        new URL('../style/base.css', import.meta.url).toString()
    ]
    

    static DEFAULT_OPTIONS = {};
    static CLONE_OPTION_KEYS: Set<string> // list of all default option keys that need to be cloned when options are initialized (non-primitive options)

    // guessing module stylesheets, get added to normal stylesheets array after successful fetch
    private static _dx_files:string[] = []


    protected static _module:string
    protected static _use_resources: boolean;

    declare static [METADATA]:any
    declare static [Datex.DX_TYPE]?: Datex.Type

    
    /**
     * find the x.dx file matching the x.ts module file of this component (if specified)
     */
    private static findModuleBoundDatexScripts(){
        if (this._use_resources) {
            const dx_url = this._module.replace(/\.m?(ts|js)x?$/, '.dx');
            this._dx_files = [...this._dx_files]; // create new dx module array are for this class
            this._dx_files.unshift(dx_url)
        }
    }

    private static _dx_loaded_resolve?:Function
    private static _dx_loaded_promise?:Promise<void>

    private static async loadModuleDatexImports(){

        // return promise if loaded / loading
        if (Object.hasOwn(this, '_dx_loaded_promise') && this._dx_loaded_promise) return this._dx_loaded_promise;
        this._dx_loaded_promise = new Promise(resolve=>this._dx_loaded_resolve=resolve);

        this.findModuleBoundDatexScripts();

        const valid_dx_files:string[] = [];
        const dx_file_values = new Map<string,[any,Set<string>]>();

        for (const path of this._dx_files) {
            try {
                // deno local file
                if (path.startsWith("file://")) {
                    if (new Path(path).fs_exists) await this.loadDatexModuleContents(path, valid_dx_files, dx_file_values)
                }
                // web path
                else {
                    if (await fileExists(path)) await this.loadDatexModuleContents(path, valid_dx_files, dx_file_values)
                }
            }
            catch (e) {
                if (path.startsWith("file://")) throw e
                
                // TODO: weird fix, fetch again if error
                else {
                    try {
                        await this.loadDatexModuleContents(path, valid_dx_files, dx_file_values)
                    }
                    catch {}
                }
            }
        }

        // inherit
        this.virtualDatexPrototype = Object.create(this.virtualDatexPrototype)

        await this.loadDatexImports(this, valid_dx_files, dx_file_values);

        this._dx_loaded_resolve?.();
    }

    private static async loadDatexModuleContents(path: string, valid_dx_files:string[], dx_file_values:Map<string, [any, Set<string>]>) {
        valid_dx_files.push(path);
        try {
            dx_file_values.set(path, [<any>await get(path, undefined, this._module), new Set()])
            logger.debug("loaded DATEX module script: " + path)    
        }
        catch (e) {
            throw new Error("Error loading DATEX module script '" + path + "': " + e?.stack)
        }
    }

    // used as workaround to simulate prototype inheritence of datex properties bound with @include
    private static virtualDatexPrototype:Record<string,unknown> = {}

    private static async loadDatexImports(target:Component|typeof Component, valid_dx_files:string[], dx_file_values:Map<string,[any,Set<string>]>){
        const allowed_imports:Record<string,[string, string]> = target[METADATA]?.[IMPORT_PROPS]?.public
        
        // try to resolve imports
        for (const [prop, [location, exprt]] of Object.entries(allowed_imports??{})) {
            // try to get from module dx files
            if (location == undefined) {
                let found = false;

                if (!valid_dx_files.length) {
                    if (!this._use_resources) throw new Error(`Could not load export '${exprt}' for component class '${this.name}' - external resources are disabled. Either remove the @NoResources decorator and create a corresponding DATEX file next to the TypeScript module file, or specifiy a different resource location in the @include decorator.`)
                    else if (!this._module) throw new Error(`Could not load export '${exprt}' for component class '${this.name}'. The component module could not be initialized correctly (missing @defaultOptions decorator?)`);  // this.module could not be set for whatever reason
                    else throw new Error(`No corresponding DATEX module file found for export '${exprt}' in component class '${this.name}'. Please create a DATEX file '${this._module.replace(/\.m?(ts|js)x?$/, '.dx')} or specifiy a resource location in the @include decorator.`)
                }

                for (const file_data of dx_file_values.values()) {
                    const file_val = file_data[0];
                    if (exprt == "*") {
                        this.virtualDatexPrototype[prop] = file_val;
                        found = true;
                        file_data[1].add(exprt); // remember that export was used
                        logger.debug(`using DATEX export '${exprt}' ${exprt!=prop?`as '${prop}' `:''}in '${this.name}'`);
                    }
                    else if (Datex.DatexObject.has(file_val, exprt)) {
                        this.virtualDatexPrototype[prop] = Datex.DatexObject.get(file_val, exprt);
                        found = true;
                        file_data[1].add(exprt); // remember that export was used
                        logger.debug(`using DATEX export '${exprt}' ${exprt!=prop?`as '${prop}' `:''}in '${this.name}'`);
                        break;
                    }
                }
                if (!found) {
                    throw new Error(`'${exprt}' is not exported in ` + valid_dx_files.join(" or "))
                }
            }
            
            else {
                let err:Error|undefined;
                try {
                    const res = await get(location, undefined, this._module);
                    if (exprt == "*") {
                        this.virtualDatexPrototype[prop] = res;
                    }
                    else {
                        if (Datex.DatexObject.has(<Record<string | symbol, unknown>>res, exprt)) { 
                            this.virtualDatexPrototype[prop] = Datex.DatexObject.get(<Record<string | symbol, unknown>>res, exprt);
                        }
                        else err = new Error(`Could not load export '${exprt}' for component class '${this.name}': Not exported from location '${location}'`)
                    }
                   
                }
                catch (e) {
                    throw new Error(`Error loading export '${exprt}' for component class '${this.name}' from location '${location}: ${e?.stack}`)
                }

                if (err) throw err; // throw inner error
               
            }

        }
    }

    private static standalone_loaded = new Set<typeof Component>();
    private static standalone_class_code = new Map<typeof Component,string>();

    private static async loadStandaloneProps() {
        if (this.standalone_loaded.has(this)) return;
        this.standalone_loaded.add(this);

        this.standaloneMethods = {};
        this.standaloneProperties = {};

        const props:Record<string, string> = this[METADATA]?.[STANDALONE_PROPS]?.public;
        const originProps:Record<string, propInit> = this[METADATA]?.[ORIGIN_PROPS]?.public;
        const idProps:Record<string,string> = this[METADATA]?.[ID_PROPS]?.public;
        const layoutProps:Record<string,string> = this[METADATA]?.[LAYOUT_PROPS]?.public;
        const contentProps:Record<string,string> = this[METADATA]?.[CONTENT_PROPS]?.public;
        const childProps:Record<string,string> = this[METADATA]?.[CHILD_PROPS]?.public;

        const allStandaloneProps = {...props, ...idProps, ...layoutProps, ...contentProps, ...childProps};
        
        // TODO: required? workaround: if [STANDALONE_PROPS] from parent isn't overriden, skip this:
        for (const name of Object.keys(allStandaloneProps)) {
            const desc = Object.getOwnPropertyDescriptor(this.prototype, name)
            // is method
            if (!desc?.get && !desc?.set && (this.prototype as any)[name]) {
                // also bound to origin
                if (originProps?.[name]) {
                    this.addStandaloneProperty(name, originProps?.[name]);
                } else this.addStandaloneMethod(name, (this.prototype as any)[name]);
            }
            // otherwise, instance property
            else this.addStandaloneProperty(name, originProps?.[name]);
        }
      
        const type = Datex.Type.getClassDatexType(this as any)!

        // check if prototype methods include use() statement
        for (const name of Object.getOwnPropertyNames(this.prototype)) {
            const desc = Object.getOwnPropertyDescriptor(this.prototype, name)
            if (desc?.get || desc?.set) continue;
            if (name == "constructor") continue;
            const method = (this.prototype as any)[name];
            const useDeclaration = JSTransferableFunction.functionIsAsync(method) ? await getDeclaredExternalVariablesAsync(method) : getDeclaredExternalVariables(method);
            // just standalone, no external variables
            if (useDeclaration.flags?.includes("standalone") && !Object.keys(useDeclaration.vars).length) {
                this.addStandaloneMethod(name, method);
            }
            // (standalone) transferable function
            else if (Object.keys(useDeclaration.vars).length) {
                (this.prototype as any)[name] = $$(JSTransferableFunction.create(method, undefined, useDeclaration)); 
                if (useDeclaration.flags?.includes("standalone")) this.addStandaloneMethod(name, (this.prototype as any)[name]);
                // also override type template to add overridden transferable function as datex property
                type.template[name] = Datex.Type.js.TransferableFunction;
                type.setTemplate(type.template);
            }
        }
    }

    private static inferredStandaloneMethods:Record<string,string[]> = {
        'onRoute': ['resolveRoute']
    }

    // add methods that run in standalone mode
    private static standaloneMethods:Record<string, Function> = {};
    protected static addStandaloneMethod(name: string, value: Function) {
        this.standaloneMethods[name] = value;
        // add inferred methods
        for (const method of this.inferredStandaloneMethods[name]??[]) this.addStandaloneMethod(method, this.prototype[<keyof typeof this.prototype>method]);
    }

    protected isStandaloneProperty(name:string) {
        return !! (this[METADATA]?.[STANDALONE_PROPS]?.public?.[name])
    }

    // add instance properties that are loaded in standalone mode
    protected static standaloneProperties:standaloneProperties = {};
    protected static addStandaloneProperty(name: string, init?:propInit) {
        if (name in (this[METADATA]?.[ID_PROPS]?.public??{})) {
            const id = this[METADATA]?.[ID_PROPS]?.public[name];
            // // extract initializer from class source code
            // const classCode = this.toString().replace(/.*{/, '');
            // const propertyCode = classCode.match(new RegExp(String.raw`\b${name}\s*=\s*([^;]*)\;`))?.[1];
            // if (!propertyCode) {
            //     console.log(classCode)
            //     throw new Error("Could not create @standalone property \""+name+"\". Make sure you add a semicolon (;) at the end of the property initialization.")
            // }
            this.standaloneProperties[name] = {type:'id', id, init};
        }
        else if (name in (this[METADATA]?.[CONTENT_PROPS]?.public??{})) {
            const id = this[METADATA]?.[CONTENT_PROPS]?.public[name] ?? this[METADATA]?.[ID_PROPS]?.public[name];
            this.standaloneProperties[name] = {type:'content', id, init};
        }
        else if (name in (this[METADATA]?.[LAYOUT_PROPS]?.public??{})) {
            const id = this[METADATA]?.[LAYOUT_PROPS]?.public[name] ?? this[METADATA]?.[ID_PROPS]?.public[name];
            this.standaloneProperties[name] = {type:'layout', id, init};
        }
        else if (name in (this[METADATA]?.[CHILD_PROPS]?.public??{})) {
            const id = this[METADATA]?.[CHILD_PROPS]?.public[name] ?? this[METADATA]?.[ID_PROPS]?.public[name];
            this.standaloneProperties[name] = {type:'child', id, init};
        }
        // normal property
        else {
            this.standaloneProperties[name] = {type:'prop', init};
        }
    }

    /**
     * returns a pseudo class that is used in standalone mode (only generated if standalone methods exist)
     */
    public static getStandalonePseudoClass() {
        // get from cache
        if (this.standalone_class_code.has(this)) {
            return this.standalone_class_code.get(this);
        }

        const parent = this.getParentClass();

        let js_code = `class ${this.name}${parent ? ` extends globalThis.UIX_Standalone.${parent.name}`:''} {${Object.values(this.standaloneMethods).length?'\n':''}`;
        js_code += this.getStandaloneConstructor();
        for (const [_name, content] of Object.entries(this.standaloneMethods)) {
            js_code += this.getStandaloneMethodContentWithMappedImports(content) + '\n';
            if (content instanceof JSTransferableFunction && content.deps) {
                // TODO:
                throw new Error("Injecting variable with use('standalone') is currently not supported for component methods.")
            }
        }
        js_code += '}'

        // save static class code in cache
        this.standalone_class_code.set(this,js_code);
        return js_code;
    }

    /**
     * returns the parent class if not Component
     */
    public static getParentClass(): typeof Component {
        return Object.getPrototypeOf(this) != domContext.HTMLElement ? Object.getPrototypeOf(this) : null;
    }

    /**
     * maps file import paths (datex.get or import) in JS source code to web paths
     */
    private static getStandaloneMethodContentWithMappedImports(method:Function, name?: string){
        const content = method.toString().replace(/(import|datex\.get) *\((?:'((?:\.(\.)?\/).*)'|"((?:\.(\.)?\/).*)")\)/g, (m,g1,g2,g3,g4)=>{
            const relImport = g2 ?? g4;
            const absImport = new Path(relImport, this._module);

            return `${g1}("${convertToWebPath(absImport)}")`
        })
        // transferable funciton
        if (method instanceof JSTransferableFunction) 
            return content.replace(/^(async )?function/, '');
        
        if (name)
            return content.replace("function", name);

        return content;
    }

    protected static standaloneEnabled() {
        return !! (
            Object.keys(this.standaloneMethods).length || 
            Object.keys(this.standaloneProperties).length ||
            Object.getPrototypeOf(Object.getPrototypeOf(this)).standaloneEnabled?.()
        )
    }


    protected static getStandaloneConstructor() {
        if (this.name === Component.name) return indent(4) `
            _standalone_construct() {
                this.standalone = true;
            }
        `
        else {
            const propInit = this.generatePropertySelectorCode();
            if (propInit) {
                return indent(4) `
                _standalone_construct() {
                    ${propInit};
                    super._standalone_construct();
                }
                `
            }
            else return "";
        }
    }

    protected static generatePropertySelectorCode() {
        let js_code = "";

        // bind content properties
        const idProps:Record<string,string> = {};
        const contentProps:Record<string,string> = {};
        const layoutProps:Record<string,string> = {};
        const childProps:Record<string,string> = {};

        let has_content_prop = false;
        for (const [name, data] of Object.entries(this.standaloneProperties)) {
            if (data.type == "id") {idProps[name] = data.id; has_content_prop=true;}
            else if (data.type == "content") {contentProps[name] = data.id; has_content_prop=true;}
            else if (data.type == "layout") {layoutProps[name] = data.id; has_content_prop=true;}
            else if (data.type == "child") {childProps[name] = data.id; has_content_prop=true;}
        }
        if (has_content_prop) {
            js_code += `bindContentProperties(this, ${JSON.stringify(idProps)}, ${JSON.stringify(contentProps)}, ${JSON.stringify(layoutProps)}, ${JSON.stringify(childProps)}, true, false);\n`
        }

        for (const [name, data] of Object.entries(this.standaloneProperties)) {
            // normal property init
            if (data.type == "prop") {
                // js_code += `this["${name}"] = ${data.init};\n`
            }
            // check if already in DOM, otherwise create (TODO: improve)
            else if (data.type == "id") {
                js_code += `this["${name}"] = ${this.getSelectorCode(data, 'this')};\n`
            }
            // @content, @child, @layout - find with selector
            else {
                js_code += `this["${name}"] = ${this.getSelectorCode(data, 'this')};\n`;
            } 
        }
        return js_code;
    }

    protected static getSelectorCode(propData:standaloneContentPropertyData, self:string) {
        // direct child, never in shadow root
        if (propData.type == "child") return `${self}.querySelector("#${propData.id}")`;
        // others might be in shadow root
        else return `${self}.shadowRoot?.querySelector("#${propData.id}") ?? ${self}.querySelector("#${propData.id}")`;
    }

    /** wait until static (css) and dx module files loaded */
    public static async init() {
        // init all parent components up the prototype chain (static super.init())
        const parent = Object.getPrototypeOf(this)
        if (parent !== Component) await Component.init.call(Object.getPrototypeOf(parent));
        await this.loadModuleDatexImports();
    }


    private static module_stylesheets:string[] = []
    private static style_sheets_by_url = new Map<string, CSSStyleSheet|false>()
    private static style_sheets_loaders = new Map<string, Promise<CSSStyleSheet|false>>()

    /**
     * Get a stylesheet from an url or from cache
     * @param url URL or url string to css file
     * @returns the created stylesheet
     */
    private static getURLStyleSheet(url:string|URL, allow_fail = false):Promise<CSSStyleSheet|false>|CSSStyleSheet|false {
        const url_string = url.toString();

        // already loaded
        if (this.style_sheets_by_url.has(url_string)) {
            return this.style_sheets_by_url.get(url_string)!;
        } 
        // there's already an active loader - await
        else if (this.style_sheets_loaders.has(url_string)) {
            return this.style_sheets_loaders.get(url_string)!;
        }
        // create new (fetch stylesheet)
        else {
            const loader = new Promise<CSSStyleSheet|false>(async resolve=>{
                const stylesheet = await this.loadURLStyleSheet(url_string, allow_fail);
                resolve(stylesheet);
                this.style_sheets_loaders.delete(url_string); // remove loader
            })
            this.style_sheets_loaders.set(url_string, loader);
            return loader;
        }
    }

    /**
     * Load a stylesheet URL to a CSSStyleSheet and save in Component class cache
     * @param url css file url
     * @returns the constructed stylesheet
     */
     private static async loadURLStyleSheet(url:string, allow_fail = false){

        if (!await fileExists(url)) {
            this.style_sheets_by_url.set(url, false) // save invalid stylesheet
            if (!allow_fail) {
                logger.error("could not load css stylesheet: " + url);
            }
            return false;
        }

        let res:Response;
        try {
            res = await fetch(url);
        } 
        catch (e) {
            if (!allow_fail) logger.error("could not load css stylesheet: " + url);
            return false;
        }

        // response was okay
        if (res.ok) {
            const stylesheet = <CSSStyleSheet> new window.CSSStyleSheet();
            const style = await res.text();
            await stylesheet.replace(style);
    
            this.style_sheets_by_url.set(url, stylesheet) // save
            logger.debug("css stylesheet loaded: " + url)

            return stylesheet;
        }

        else {
            this.style_sheets_by_url.set(url, false) // save invalid stylesheet
            if (!allow_fail) {
                logger.error("could not load css stylesheet: " + url);
            }
            return false;
        }

    }

    /**
     * Preload the required stylesheets for this component (fetch URLs and save in cache as CSSStyleSheets)
     * @returns all CSSStyleSheets
     */
    public static preloadStylesheets():Promise<(CSSStyleSheet|false)[]> {
        // clone this.stylesheets for current class if not already cloned
        this.stylesheets = [...this.stylesheets];
        this.shadow_stylesheets = [...this.shadow_stylesheets];
        // find matching .css and .dx files by name
        this.addPotentialModuleStylesheet(); 

        const loaders:Promise<CSSStyleSheet|false>[] = [];

        for (const url of [...this.stylesheets, ...this.shadow_stylesheets]) {
            // add to loaders if not already loading/loaded
            if (!this.style_sheets_by_url.has(url) && !this.style_sheets_loaders.has(url)) {
                loaders.push(<Promise<CSSStyleSheet|false>>this.getURLStyleSheet(url, this.module_stylesheets.includes(url)))
            }
        }

        return Promise.all(loaders)
    }

    /**
     * find the x.css file matching the x.ts module file of this component (if specified)
     */
    private static addPotentialModuleStylesheet(){
        if (this._use_resources) {
            const css_url = this._module.replace(/\.m?(ts|js)x?$/, '.css');
            
            this.module_stylesheets = [...this.module_stylesheets]; // create new module stylesheets are for this class
            this.module_stylesheets.push(css_url); // remember as module stylesheets
            const url_string = new URL(css_url).toString();
            if (!this.stylesheets.includes(url_string)) {
                this.stylesheets.push(url_string) // add to normal stylesheets
            }
            if (!this.shadow_stylesheets.includes(url_string)) {
                this.shadow_stylesheets.push(url_string) // add to shadow stylesheets
            }
        }
    }





    /************************************ END STATIC ***************************************/

    // options
    @property declare options:Datex.ObjectRef<O>; // uses element.DEFAULT_OPTIONS as default options (also for all child elements)

    declare public readonly props: Datex.DatexObjectInit<O> & {children?:ChildElement|ChildElement[]} & JSX._IntrinsicAttributes<this>

    declare $:Datex.Proxy$<this> // reference to value (might generate pointer property, if no underlying pointer reference)
    declare $$:Datex.PropertyProxy$<this> // always returns a pointer property reference

    declare [METADATA]:any
    declare [OPEN_GRAPH]?:OpenGraphInformation


    /**
     * true if component is in standalone mode (UIX library not loaded)
     */
    public standalone = false;

    protected openGraphImageGenerator?: OpenGraphPreviewImageGenerator; // set the custom preview image generator for open graph cards

    protected is_skeleton = false // true if component not yet fully initialized, still displayed as skeleton and not associated with DATEX object

    protected reconstructed_from_dom = false

    constructor()
    constructor(options?:Datex.DatexObjectInit<O>)
    constructor(options?:Datex.DatexObjectInit<O>) {
        // constructor arguments handlded by DATEX @constructor, constructor declaration only for IDE / typescript
        super()


        // pre-init options before other DATEX state is initialized 
        // (this should not happen when reconstructing, because options are undefined or have [INIT_PROPS])
        if (options && !options[INIT_PROPS]) this.initOptions(options);

        // handle special case: was created from DOM
        if (!Datex.Type.isConstructing(this)) {
            // @ts-ignore preemptive [INIT_PROPS], because construct is called - normally handled by js interface (TODO: better solution?)
            if (options?.[INIT_PROPS]) options[INIT_PROPS](this);

            const classType = Datex.Type.getClassDatexType(this.constructor as typeof Component);
            if (classType.name !== "uix") {
                console.log(this.constructor);
                logger.error("cannot construct UIX element from DOM because DATEX type could not be found ("+this.constructor.name+")")
                return;
            }
            this.reconstructed_from_dom = true;

            // ignore if currently hydrating static element
            if (this.hasAttribute("uix-static") || this.hasAttribute("uix-dry")) {
                this.is_skeleton = true;
                logger.debug("hydrating component " + classType);
                // throw error if option properties are access during class instance member initialization (can't know options at this point)
                this.options = new Proxy({}, {
                    get: (target, prop) => {
                        throw new Error(`Tried to access uninitialized option property '${String(prop)}' during class instance member initialization of hydrated component. Please put the property initialization in the onConstruct() method.`)
                    }
                })
            }
            else {
                // logger.debug("creating " + this.constructor[Datex.DX_TYPE] + " component from DOM");
                return (<Datex.Type>classType).construct(this, [], true, true);
            }
        }

    }

    override attachShadow(init:ShadowRootInit) {
        const shadowRoot = super.attachShadow(init);
        this.initShadowRootStyle();
        return shadowRoot!;
    }

    /**
     * don't send shadow root over datex, not part of component state like for default html elements with custom shadow dom
     */
    private disableShadowForDATEX(){
        (<any>this.shadowRoot)![DX_IGNORE] = true;
    }

    private initShadowRootStyle() {
        // TODO: still required?
        // this.addStyleSheet(UIX.Theme.stylesheet);
        for (const url of (<typeof Component>this.constructor).shadow_stylesheets??[]) this.addStyleSheet(url);
        // this.disableShadowForDATEX();
    }

    // apply css properties to this element
    public css(property:string, value?:Datex.RefOrValue<string|number>):this
    public css(properties:{[property:string]:Datex.RefOrValue<string|number>}):this
    public css(properties_object_or_property:{[property:string]:Datex.RefOrValue<string|number>}|string, value?:Datex.CompatValue<string|number>):this {
        if (typeof properties_object_or_property == "string") return domUtils.setCSS(this, properties_object_or_property, value)
        else return domUtils.setCSS(this, properties_object_or_property)
    }

    // add css classes
    public cssClass(classes:Datex.RefOrValue<string[]>):this
    public cssClass(...classes:string[]):this
    public cssClass(...classes:(Datex.RefOrValue<string[]>|string)[]):this {
        return domUtils.setCssClass(this, ...<string[]>classes);
    }

    private handleIdProps(constructed=false){
        const constructorList = [this.constructor] 
        while (true) {
            const _constructor = Object.getPrototypeOf(Object.getPrototypeOf(constructorList.at(-1)!));
            if (_constructor === domContext.HTMLElement || _constructor === domContext.Element || _constructor === Object)
                break;
            constructorList.push(_constructor);
        }
        for (const constr of constructorList.toReversed()) {
            const id_props:Record<string,string> = (constr as any)[METADATA]?.[ID_PROPS]?.public;
            const content_props:Record<string,string> = (constr as any)[METADATA]?.[CONTENT_PROPS]?.public;
            const layout_props:Record<string,string> = (constr as any)[METADATA]?.[LAYOUT_PROPS]?.public;
            // only add children when constructing component, otherwise they are added twice
            const child_props:Record<string,string> = constructed ? (constr as any)[METADATA]?.[CHILD_PROPS]?.public : undefined;
            bindContentProperties(this, id_props, content_props, layout_props, child_props);
        }
    }


    #datex_lifecycle_ready_resolve?:Function
    #datex_lifecycle_ready = new Promise((resolve)=>this.#datex_lifecycle_ready_resolve = resolve)

    #create_lifecycle_ready_resolve?:Function
    #create_lifecycle_ready = new Promise((resolve)=>this.#create_lifecycle_ready_resolve = resolve)

    #anchor_lifecycle_ready_resolve?:Function
    #anchor_lifecycle_ready = new Promise((resolve)=>this.#anchor_lifecycle_ready_resolve = resolve)

    private static template?:jsxInputGenerator<HTMLElement,any,any,any>
    private static style_templates?:Set<jsxInputGenerator<DynamicCSSStyleSheet|URL,any,any,any>>

    /**
     * Promise that resolves after onConstruct is finished
     */
    get constructed() {
        return this.#datex_lifecycle_ready
    }

    /**
     * Promise that resolves after onCreate is finished (resolves immediately after component was removed and re-anchored)
     */
    get created() {
        return this.#create_lifecycle_ready
    }

    /**
     * Promise that resolves when anchored to the DOM (can be used again after component was removed and re-anchored)
     */
    get anchored() {
        return this.#anchor_lifecycle_ready
    }

    /**
     * Only executed after component was added to DOM and onCreate was called
     * @param handler function to execute
     */
    async defer(handler:(...args:unknown[])=>unknown):Promise<void> {
        await this.anchored;
        await handler(); 
    }

    // default constructor
    async construct(options?:Datex.DatexObjectInit<O>): Promise<void> {
        // options already handled in constructor

        // handle default component options (class, ...)
        if (this.options?.class) 
            domUtils.setElementAttribute(this, "class", this.options.$.class);
        
        await sleep(0); // TODO: fix: makes sure constructor is finished?!, otherwise correct 'this' not yet available in Component.init
 
        if (!((<typeof Component>this.constructor).prototype instanceof Component)) {
            logger.warn("Cannot initialize standalone component as normal UIX component (<"+this.tagName.toLowerCase()+">)")
            return;
        }


        // make sure static component data (e.g. datex module imports) is loaded
        await (<typeof Component>this.constructor).init();
        this.inheritDatexProperties();

        if (!this.reconstructed_from_dom) await this.loadTemplate();
        else this.logger.debug("Reconstructed from DOM, not creating new template content")
        this.loadDefaultStyle()
        await this.init(true);
        await this.onConstructed?.();

        this.#datex_lifecycle_ready_resolve?.(); // onCreate can be called (required because of async)
    }

    // called when created from saved state
    async replicate() {
        await sleep(0); // TODO: fix: makes sure constructor is finished?!, otherwise correct 'this' not yet available in child class init
        // make sure static component data (e.g. datex module imports) is loaded
        await (<typeof Component>this.constructor).init();
        this.inheritDatexProperties();

        this.loadDefaultStyle()
        await this.init();
        this.#datex_lifecycle_ready_resolve?.(); // onCreate can be called (required because of async)
    }

    /**
     * load template (@UIX.template)
     */
    private async loadTemplate() {
        if ((<typeof Component> this.constructor).template) {
            // don't get proxied options where primitive props are collapsed by default - always get pointers refs for primitive options in template generator
            const templateFn = (<typeof Component> this.constructor).template!;
            const template = await templateFn(Datex.Pointer.getByValue(this.options)?.shadow_object ?? this.options, this);
            domUtils.append(this, template);
        }
    }

    /**
     * load stylesheet from @style
     */
    private loadDefaultStyle() {
        for (const templateFn of (<typeof Component> this.constructor).style_templates??[]) {
            // don't get proxied options where primitive props are collapsed by default - always get pointers refs for primitive options in template generator
            const options = Datex.Pointer.getByValue(this.options)?.shadow_object ?? this.options
            const stylesheet = templateFn(options, this)
            // invalid scoped stylesheet
            if (stylesheet.scope && stylesheet.scope !== this.tagName.toLowerCase()) throw new Error(`Stylesheet uses multiple component scopes (<${stylesheet.scope.toLowerCase()}>, <${this.tagName.toLowerCase()}>). Make sure you don't use the same stylesheet for multiple components.`)
            // inject css scoping if component has no shadow root
            if (stylesheet instanceof CSSStyleSheet && !this.shadowRoot && !stylesheet.scope) {
                const css = stylesheet._cached_css ?? [...(stylesheet.cssRules as any)].map(r=>r.cssText).join("\n");
                const scopedCSS = addCSSScopeSelector(css, this.tagName.toLowerCase())
                stylesheet.replaceSync(scopedCSS)
                stylesheet.scope = this.tagName.toLowerCase();
            }
            if (stylesheet instanceof CSSStyleSheet && stylesheet.activate) {
                stylesheet.activate(this.shadowRoot??document);
                this.activatedScopedStyles.add(stylesheet)
            }
            else if (stylesheet instanceof CSSStyleSheet) this.addStyleSheet(stylesheet)
            else this.addStyleSheet(stylesheet)
        }
    }

    private initOptions(options?: Datex.DatexObjectInit<O>){
        if (this.options) {
            console.log("already has options");
            return;
        }
        const default_options = (<any>this.constructor).DEFAULT_OPTIONS;
        const clone_option_keys = (<any>this.constructor).CLONE_OPTION_KEYS;

        // get options from html attributes
        if (!options) options = <O>{}; 
        options = <Datex.DatexObjectInit<O>> $$(options);           
        for (let i=0;i < this.attributes.length; i++) {
            const name = this.attributes[i].name;
            // don't override provided options object
            if (!(name in options)) {
                // json (number, array, ...) - for attributes written in html (strings per default, must be converted to the right type)
                try {
                    options[<keyof typeof options>name] = JSON.parse(this.attributes[i].value);
                } 
                // string
                catch {
                    options[<keyof typeof options>name] = <Datex.RefOrValue<O>> this.attributes[i].value;
                }
            }
        }

        // assign default options as prototype
        this.options = assignDefaultPrototype(default_options, options, clone_option_keys);
    }

    /**
     * bind datex properties from virtualDatexPrototype to this instance
     */
    private inheritDatexProperties() {
        Object.assign(this, (<typeof Component>this.constructor).virtualDatexPrototype);
    }


    // init for base element (and every element)
    protected async init(constructed = false) {
        // handle shadow root setup
        if (this.shadowRoot) this.initShadowRootStyle();

        // Component style sheets
        const loaders = []
        for (const url of (<typeof Component>this.constructor).stylesheets??[]) loaders.push(this.addStyleSheet(url));
    
        let standaloneOnDisplayWasTriggered = false
        if ((this as any)[DISPOSE_BOUND_PROTOTYPE]) {
            standaloneOnDisplayWasTriggered = (this as any)[DISPOSE_BOUND_PROTOTYPE]();
        }

        this.onCreateLayout?.(); // custom layout extensions

        // @id, @content, @layout
        this.handleIdProps(constructed);
   
        // @standlone props only relevant for backend
        if (UIX.context == "backend") await this.loadStandaloneProps();

        Datex.Pointer.onPointerForValueCreated(this, () => {
            const pointer = Datex.Pointer.getByValue(this)!
            if (!this.hasAttribute("uix-ptr")) this.setAttribute("uix-ptr", pointer.id);

            if (this.is_skeleton && UIX.context == "frontend") {
                this.logger.debug("hybrid initialization")
                if (!standaloneOnDisplayWasTriggered) this.onDisplay?.();
            }
            // TODO: required? should probably not be called per default
            // bindObserver(this)
        })

        if (constructed) await this.onConstruct?.();
        // this.bindOriginMethods();

        await this.onInit?.() // element was constructed, not fully loaded / added to DOM!
        this.enableDefaultOpenGraphGenerator();

        //await Promise.all(loaders); // TODO: await stylesheet loading? leads to errors
    }

    // load standalone props recursively, including all parent classes
    private async loadStandaloneProps() {
        let clss = <any>this.constructor;
        do {
            await (<typeof Component>clss).loadStandaloneProps();
        } while ((clss=Object.getPrototypeOf(Object.getPrototypeOf(clss))) && clss != domContext.HTMLElement && clss != domContext.Element && clss != Object); //  prototype chain, skip proxies inbetween
    }

    private enableDefaultOpenGraphGenerator() {
        if (this[OPEN_GRAPH]) return; // already overridden
        Object.defineProperty(this, OPEN_GRAPH, {
            get() {return new OpenGraphInformation({
                title: this.title ?? app.options?.name,
                description: this.options.description ?? app.options?.description
            }, this.openGraphImageGenerator)}
        })
    }

    // clone self as DATEX value
    public async clone(){
        return await Datex.Runtime.deepCloneValue(this);
    }

    // used in render.ts
    protected standaloneEnabled() {
        return !! (
            (<typeof Component>this.constructor).standaloneEnabled() ||
            this.standalone_handlers.size
        )
    }


    // add function for this instance that is immediately invoked in standalone mode
    private standalone_handlers = new Set<Function>()
    protected addStandaloneHandler(handler:Function) {
        this.standalone_handlers.add(handler);
    }

    // get instance specific standalone js code that is immediately executed
    public getStandaloneInit() {
        let js_code = '';
 
        js_code += `const self = querySelector("[uix-ptr='${this.getAttribute("uix-ptr")}']");\n`
        js_code += `bindPrototype(self, globalThis.UIX_Standalone.${this.constructor.name});\n`

        const scope = this.constructor as any;
        const originProps:Record<string, propInit>|undefined = scope[METADATA]?.[ORIGIN_PROPS]?.public;

        // init props with current values
        for (const [name, data] of Object.entries((this.constructor as typeof Component).standaloneProperties)) {
            // check if prop is method
            if (typeof this[<keyof this>name] === "function") {
                if (originProps?.[name] && !(this[<keyof this>name] as any)[BOUND_TO_ORIGIN]) {
                    // @ts-ignore $
                    this[<keyof this>name] = bindToOrigin(this[<keyof this>name], this, null, originProps[name].datex);
                }
                js_code += `self["${name}"] = ${Component.getStandaloneMethodContentWithMappedImports(this[<keyof this>name] as Function)};\n`;
            }
            
            // init from origin context (via datex)
            else if (data.init) {
                js_code += `self["${name}"] = ${getValueInitializer(this[<keyof this>name], data.init.datex)};\n`
            }
            // normal property init
            else if (data.type == "prop") {
                js_code += `self["${name}"] = ${serializeJSValue(this[<keyof this>name])};\n`
            }
        }

        // call custom standalone handlers
        for (const handler of this.standalone_handlers) {
            // workaround to always set 'this' context to UIX component, even when handler is an arrow function
            js_code += `await (function (){return (${(<typeof Component>this.constructor).getStandaloneMethodContentWithMappedImports(handler)})()}).apply(self);\n`;
        }
        
        // standalone constructor + lifecycle
        js_code += `self._standalone_construct();\n`
        js_code += `self.onDisplay?.();`
        return js_code;
    }


    #focusable = false;

    public get focusable(){
        return this.#focusable;
    }
    public set focusable(focusable:boolean){
        this.#focusable = focusable;
        if (this.#focusable) this.setAttribute("tabindex", "-1")
        else this.removeAttribute("tabindex")
    }

    // is element the current top parent (root) element
    public get is_root_element(){
        return this.parentElement == document.body || (this.parentElement instanceof Component && this.parentElement.isChildPseudoRootElement(this));
    }
    
    #created = false; // set to true if onCreate has been called

    // get parent element if type matches, else throw error
    assertParent<P extends HTMLElement>(parent: Class<P>): P {
        if (this.parentElement instanceof parent) return <P> this.parentElement;
        else if (!parent) new ValueError(`Component should have a parent of type ${Datex.Type.getClassDatexType(parent)}, but has none`);
        else throw new ValueError(`Component parent has type ${Datex.Type.ofValue(this.parentElement)}, but should be ${Datex.Type.getClassDatexType(parent)}`);
        // workaround: only for ts - never reached
        return <P><unknown>null;
    }

    // get any parent element (recursive), return first match
    assertNextParent<P extends HTMLElement>(parent: Class<P>):P {
        if (this.parentElement) {
            try {
                return this.assertParent(parent);
            }
            catch {
                if (this.parentElement instanceof Component) return this.parentElement.assertNextParent(parent);
                else throw "";
            }
        }
        else throw new ValueError(`Now matching parent component of type ${Datex.Type.getClassDatexType(parent)} found`);
    }


    // component becomes full-featured uix component, no longer a skeleton
    public unSkeletonize() {
        if (!this.is_skeleton) return;

        this.is_skeleton = false;
        this.removeAttribute("uix-static");
        this.removeAttribute("uix-dry");

        // continue component lifecycle
        const type = Datex.Type.ofValue(this);
        type.initProperties(this, {options:$$({})});
        // trigger UIX lifecycle (onReplicate)
        type.construct(this, undefined, false, true);

        // await this.replicate();
        //this.updateResponsive();

        // if (this instanceof Group) {
        //     for (let child of this.elements) {
        //         child.connectedCallback();
        //     }
        // }
       
    }

    /**
     * Only executed after all components were fully constructed (DATEX initialized)
     * @param handler function to execute
     */
    static async deferConstructed(components:Component[], handler:(...args:unknown[])=>unknown):Promise<void> {
        await Promise.all(components.map(c => c.constructed))
        await handler(); 
    }

    disconnectedCallback() {

        // reset anchor lifecycle
        this.#anchor_lifecycle_ready = new Promise((resolve)=>this.#anchor_lifecycle_ready_resolve = resolve)
        
        // assume next route as new initial route
        this.route_initialized = false;

        // handle child on parent
        if (this.parentElement instanceof Component) {
            Component.deferConstructed([this, this.parentElement], ()=>{
                (this.parentElement as Component).onChildRemoved(this)
            })
        }
    
    }

    bindOriginMethods() {
        const scope = this.constructor.prototype;
        const originProps:Record<string, propInit> = scope[METADATA]?.[ORIGIN_PROPS]?.public;

        for (const [name, content] of Object.entries((this.constructor as typeof Component).standaloneMethods)) {
            console.log("bind to origin", name, originProps?.[name])
            if (originProps?.[name]) {
                // @ts-ignore
                this[name as keyof typeof scope] = bindToOrigin(scope[<keyof typeof scope>name], this, name, originProps[name].datex);
                // @ts-ignore
                console.log(this[name as keyof typeof scope]?.toString?.(), "<--- name")
            }
        }
    }
    
    // called when added to DOM
    connectedCallback() {
        // hybrid rendered, ignore, onDisplay() is called somewhere else
        if (this.is_skeleton) return;

        // handle child on parent
        if (this.parentElement instanceof Component) {
            Component.deferConstructed([this, this.parentElement], ()=>{
                if (this.parentElement instanceof Component) (this.parentElement as Component).onChildAdded(this)
            })
        }
        
        // call onAnchor, init with options dialog, etc.; async
        return this.connectedCallbackAsync();
    }

    private async connectedCallbackAsync(){

        await this.#datex_lifecycle_ready; // wait for onConstruct, init

        // // wait until lazy loaded if added to group component
        // if (this.options.lazy_load && this.parentElement instanceof Component) {
        //     // wait until first focus
        //     await this.#first_focus
        //     this.logger.info("Lazy loading")
        // }

        const new_create = !this.#created;
        this.#created = true;

        // call onCreate
        if (new_create) {
            try {
                await this.onCreate?.();
            } catch (e) { logger.error("Error calling onCreate on element"); console.error(e)}
        }
        else {
            await this.created;
        }

        // call onAnchor
        try {await this.onAnchor?.()}
        catch (e) { logger.error("Error calling onAnchor on element: ?", e)}
        await new Promise((r) => setTimeout(r, 0)); // dom changes

        await new Promise((r) => setTimeout(r, 0)); // dom changes
        if (UIX.context == "frontend") await this.onDisplay?.();
        await new Promise((r) => setTimeout(r, 0)); // dom changes

        this.#create_lifecycle_ready_resolve?.();
        this.#anchor_lifecycle_ready_resolve?.();
    }

    private route_initialized = false;

    // implements resolveRoute per default, can be overriden for more custom routing behaviour
    public async resolveRoute(route:Path.Route, context:Context):Promise<Path.route_representation> {
        const {Path} = await import("uix/utils/path.ts");

        const delegate = this.routeDelegate??this;

        if (!route?.route) return []; // TODO: should not happen?

        // ignore if route is already up to date
        if (this.route_initialized && Path.routesAreEqual(route, delegate.getInternalRoute())) return route;
        const initial_route = !this.route_initialized;
        this.route_initialized = true;

        const child = await (<Component<O, ChildElement>>delegate).onRoute?.(route.route[0]??"", initial_route);

        if (child == false) return []; // route not valid
        else if (typeof (<any>child)?.focus == "function") {
            (<any>child).focus() // bring child to foreground
        }
        // end of route reached / handled in component without redirecting to children, all ok
        if (route.route.length == 1 || !(child instanceof Element) || (typeof child?.resolveRoute !== "function")) return route; 
        // recursively follow route
        else {
            const child_route = await child.resolveRoute(Path.Route(route.route.slice(1)), context);
            return [route.route[0], ...(child_route instanceof Path ? child_route.route : child_route)];
        }
    }


    #logger?:Logger
    protected get logger(): Logger {
        this.#logger ??= new Logger(this);
        return this.#logger;
    }

    #scroll_context?:scrollContext
    
    protected makeScrollContainer(element:HTMLElement, scroll_x = true, scroll_y = true) {
        // TODO: save scroll state
        this.#scroll_context = {};
        return makeScrollContainer(element, scroll_x, scroll_y, this.#scroll_context);
    }

    /** handle the scroll position updates **/

    public updateScrollPosition(x?:number, y?:number) {
        if (!this.#scroll_context) return;
        return updateScrollPosition(this.#scroll_context, x, y);
    }

    public scrollToBottom(force_scroll = false){
        if (!this.#scroll_context) return;
        return scrollToBottom(this.#scroll_context, force_scroll);
    }

    public scrollToTop(){
        if (!this.#scroll_context) return;
        return scrollToTop(this.#scroll_context);
    }

    override remove() {
        logger.debug("remove element ?", this.id || this.constructor.name);
        super.remove();
    }

    public observeOption(key:keyof O, handler: (value: unknown, key?: unknown, type?: Datex.Ref.UPDATE_TYPE) => void) {
        Datex.Ref.observeAndInit(this.options.$$[key as keyof typeof this.options.$$], handler, this);
    }
    public observeOptions(keys:(keyof O)[], handler: (value: unknown, key?: unknown, type?: Datex.Ref.UPDATE_TYPE) => void) {
        for (const key of keys) this.observeOption(key, handler);
    }

    protected style_sheets_urls:string[] = [];

    /**
     * add a custom stylesheet as a <link> or adopted stylesheet to this component
     * @param url_or_style_sheet url to css file, css text or CSSStyleSheet
     * @param adopt if true, the style is added to the shadow root adoptedStyleSheets, otherwise (if an url is provided), the style is added as a <link>
     */
    public addStyleSheet(url:string|URL, adopt?:boolean):Promise<void>|void
    public addStyleSheet(style_sheet:CSSStyleSheet):Promise<void>|void
    public addStyleSheet(url_or_style_sheet:string|CSSStyleSheet|URL, adopt = true):Promise<void>|void {

        if (typeof url_or_style_sheet == "string" || url_or_style_sheet instanceof URL) {
            let url = new URL(url_or_style_sheet, (<typeof Component>this.constructor)._module);
            if (this.style_sheets_urls.includes(url.toString())) return; // stylesheet already added

            // allow fail if only potential module stylesheet
            const allow_fail = (<typeof Component>this.constructor).module_stylesheets.includes(url.toString());    

            // scope url
            if (!this.shadowRoot) {
                url = new URL(url + '?scope=' + this.tagName.toLowerCase()); // add scope query parameter
            }

            // adopt CSSStylesheet (works if css does not use @import and shadowRoot exists, otherwise use <link>)
            if (adopt && this.shadowRoot) {
                const stylesheet = Component.getURLStyleSheet(url, allow_fail);

                // is sync
                if (stylesheet instanceof <typeof CSSStyleSheet>window.CSSStyleSheet) {
                    this.adoptStyle(stylesheet, false, url);
                }
                else if (stylesheet) return new Promise<void>(async resolve=>{
                    const s = await stylesheet;
                    if (s) this.adoptStyle(s, false, url);
                    resolve();
                })
                // stylesheet might be false, no stylesheet, ignore (error is logged)
            }
            // insert <link>
            else return (async ()=>{
                try {
                    await this.insertStyleSheetLink(url, allow_fail);
                } catch (e) {
                    //console.debug(e);
                    if (!allow_fail) throw e;
                }
            })()
        }

        else if (url_or_style_sheet instanceof <typeof CSSStyleSheet>window.CSSStyleSheet){
            this.adoptStyle(url_or_style_sheet)
        }
    }

    protected async insertStyleSheetLink(url:URL, allow_fail = false) {
        if (allow_fail && !await fileExists(url)) return; // style sheet file does not exist
        if (this.shadowRoot) await addStyleSheetLink(this.shadowRoot, url);
        else if (client_type == "browser") await addGlobalStyleSheetLink(url);
        this.style_sheets_urls.push(url.toString());
    }

    /** shadow dom specific methods */
    /**
     * add a default adopted CSSStyleSheet which is referenced by this.shadowStyle
     */
    private addBaseStyle(){
        this.adoptStyle(":host:host {}", true); // use ':host:host' for higher specificity (should behave like inline style)
    }

    // returns style of this element, if shadowRoot not yet attached to a document (styleSheets not available, see https://github.com/WICG/webcomponents/issues/526)
    public get shadowStyle(): CSSStyleDeclaration {
        if (!this.#style_sheets.length) this.addBaseStyle();
        // init this.#adopted_root_style after style was adopted
        if (!this.#adopted_root_style && (<CSSStyleRule>this.#style_sheets[0]?.cssRules?.[0])?.style) {
            const stylesheet = this.#style_sheets[0];

            // is using polyfill which does not correctly propagate updates -> propagate updates via proxy
            // @ts-ignore CSSStyleSheet

            // safari compat
            if (window.CSSStyleSheet.name == "ConstructedStyleSheet") {
                this.#adopted_root_style = new Proxy((<CSSStyleRule>stylesheet.cssRules[0]).style, {
                    set(target, p, value) {
                        (<any>target)[p] = value;
                        // refresh style
                        stylesheet.replaceSync(`:host:host {${target.cssText}}`); // stylesheet.cssRules[0].cssText not working?
                        return true;
                    },
                    // for correct binding of getProperty/setProperty
                    get: (target, prop) => {
                        if (prop in target && (<string>prop)[0] !== '_') {
                            if (typeof (<any>target)[prop] === 'function') {
                                return (<any>target)[prop].bind(target);
                            } else {
                                return (<any>target)[prop];
                            }
                        } else {
                            throw new Error('problem');
                        }
                    }
                })
            }

            // deno server compat, just use normal CSSStyleDeclaration
            // @ts-ignore
            else if (window.CSSStyleSheet.IS_COMPAT) {
                this.#adopted_root_style = new CSSStyleDeclaration();
            }

            // normal
            else this.#adopted_root_style = (<CSSStyleRule>stylesheet.cssRules[0]).style;
        }

        // return adopted_root_style or pseudo style placeholder
        return this.#adopted_root_style ?? <CSSStyleDeclaration>this.#pseudo_style;
    }

    // adopted constructed stylesheet for shadow root
    #adopted_root_style?:CSSStyleDeclaration 

    /**
     * Add a style to the shadow root adoptedStyleSheets
     * @param style style text or CSSStyleSheet
     */
    protected adoptStyle(style:string|CSSStyleSheet, __pass_through = false, url?: URL) {
        if (!this.shadowRoot) throw new Error("Cannot adopt style on Component - no shadow root");

        // first add base style (this.style)
        if (!__pass_through && !this.#style_sheets.length) this.addBaseStyle();
        
        let stylesheet:CSSStyleSheet;

        // add to component style sheets list
        if (url) this.style_sheets_urls.push(url.toString());

        if (style instanceof window.CSSStyleSheet) stylesheet = style;
        else {
            stylesheet = new window.CSSStyleSheet();
            stylesheet.replaceSync(style);
        }
        this.#style_sheets.push(stylesheet);
        this.shadowRoot.adoptedStyleSheets = [...this.#style_sheets]; // this.#style_sheets

        return stylesheet;
    }


    // list of all adopted stylesheets for this element / shadow DOM
    #style_sheets:CSSStyleSheet[] = [];
    #pseudo_style = PlaceholderCSSStyleDeclaration.create();

    // contains all styles used for this component that are scoped and adopted on the document
    activatedScopedStyles = new Set<DynamicCSSStyleSheet>()

    // return rendered HTML for stylesheets used in this component
    public getRenderedStyle() {
        let html = "";

        // links
		for (let url of this.style_sheets_urls) {
            if (url.toString().startsWith("file://")) {
                // relative web path (@...)
                url = convertToWebPath(url);
            }
            html += `<link rel="stylesheet" href="${url}">`;
        }

        // noscript fallback style
        html += `<noscript><link rel="stylesheet" href="https://dev.cdn.unyt.org/uix/style/noscript.css"></noscript>`
   
        if (this.#adopted_root_style) {
            html += `<style>${this.#adopted_root_style.cssText}</style>`
        }
        else if (this.#pseudo_style) {
            html += `<style>:host:host{${this.#pseudo_style.cssText}}</style>`
        }

        // add theme classes
        html += `<style>${UIX.Theme.getThemesCSS().replaceAll("\n","")}</style>`

        return html;
    }
    
    /** end - shadow dom specific methods */


    // @implement child is on top edge of parent, let header behave as if child was actual root element
    protected isChildPseudoRootElement(child: ChildElement){
        return false;
    }

    protected routeDelegate?: Component; // delegate that handles all routes for this component
    /** called to get the current route of the component (child route) */
    getInternalRoute():string[] {
        const identifier = this.getRouteIdentifier();
        if (typeof identifier == "string") return [identifier]
        else return [];
    }

    protected getRouteIdentifier():string|undefined|void {}

    /** called when a route is requested from the component, return element matching the route identifier or true if route was handled */
    protected onRoute?(identifier:string, is_initial_route:boolean):Promise<void|Component|boolean>|void|Component|boolean

    /** called when a new child is appended - currently only working for child components */
    protected onChildAdded(child:ChildElement){}

    /** called when a child is removed - currently only working for child components */
    protected onChildRemoved(child:ChildElement){}

    /** called when a child is focused */
    protected onChildFocused(child:ChildElement){}
    
    /** called after added to an other Element */
    protected onAnchor?():void|Promise<void>

    /** timeout (ms) after which onCreate is no longer awaited, snapshot is taken */
    CREATE_TIMEOUT = 10_000;

    /** called after options loaded, element content can be created */
    protected onCreate?():void|Promise<void>

    /** called when anchored in a frontend environment (supports @standalone) */
    protected onDisplay?():void|Promise<void>

    /** called after removed from DOM (not moved) */
    protected onRemove?():void

    /** called after constructor */
    protected onConstruct?():Promise<void>|void

    /** called after constructor and after init */
    protected onConstructed?():Promise<void>|void

    /** called after constructor or replicator (before onConstructed, after onConstruct) */
    protected onInit?():Promise<void>|void

    /** generate custom element base layout (content_element, style) */
    protected onCreateLayout?():void

}

// construct pseudo @sync class
const type = Datex.Type.get("uixcomponent")
Component[DX_TYPE] = type;
Component[DX_ROOT] = true
type.setTemplate({
    options: any
})

// get object-like keys that need to be cloned from the prototype
export function getCloneKeys(object:any):Set<string> {
    const clone_keys = new Set<string>();
    for (const [key, value] of Object.entries(object)) {
        if (value && typeof value == "object") clone_keys.add(key);
    }
    return clone_keys;
}


// required for DEFAULT_OPTIONS prototype
function assignDefaultPrototype<T extends object>(default_object:T, object:T, clone_keys:Iterable<string> = getCloneKeys(default_object)):T {
    let res_object:T;

    // use provided object
    if (object && Object.keys(object).length) {
        if (default_object && !default_object.isPrototypeOf(object)) Object.setPrototypeOf(object, default_object);
        res_object = object;
    } 
    // default
    else {
        res_object = Object.create(default_object??{});
    }

    // clone non-primitive properties (if only in prototype and not in created object) - ignore DatexValues and pointers
    for (let key of clone_keys) {
        // @ts-ignore
        if (!res_object.hasOwnProperty(key) && res_object[key] === default_object[key] &&  !(
            // don't clone fake primitives
            res_object[key] instanceof Datex.Ref || 
            res_object[key] instanceof Datex.Type ||
            res_object[key] instanceof Datex.Target ||
            res_object[key] instanceof Datex.Quantity
        ) && !Datex.Pointer.getByValue(res_object[key])) {
            res_object[key] = structuredClone(res_object[key])
        }
    }

    return res_object;
}

