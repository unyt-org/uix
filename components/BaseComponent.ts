// deno-lint-ignore-file no-async-promise-executor
import { constructor, Datex, property, replicator, template, get} from "unyt_core"
import { logger } from "../utils/global_values.ts"
import { assignDefaultPrototype } from "../utils/utils.ts"
import { HTMLUtils } from "../html/utils.ts"
import { Actions } from "../base/actions.ts"
import { Class, Logger, METADATA, ValueError } from "unyt_core/datex_all.ts"
import { IS_HEADLESS } from "../utils/constants.ts"
import { CHILD_PROPS, CONTENT_PROPS, ID_PROPS, IMPORT_PROPS, LAYOUT_PROPS, STANDALONE_PROPS } from "../base/decorators.ts";
import { bindObserver } from "../html/datex_binding.ts";
import { Path } from "unyt_node/path.ts";
import { RouteManager } from "../html/rendering.ts";
import { Context } from "../base/context.ts";
import { makeScrollContainer, scrollContext, scrollToBottom, scrollToTop, updateScrollPosition } from "../snippets/scroll_container.ts";
import { OpenGraphInformation, OpenGraphPreviewImageGenerator, OPEN_GRAPH } from "../base/open_graph.ts";
import { App } from "../app/app.ts";
import { bindContentProperties } from "../snippets/bound_content_properties.ts";
import { DX_IGNORE, INIT_PROPS } from "unyt_core/runtime/constants.ts"
import { PlaceholderCSSStyleDeclaration, addGlobalStyleSheetLink, addStyleSheetLink } from "../utils/css_style_compat.ts";
import { indent } from "../utils/indent.ts"
import { serializeJSValue } from "../utils/serialize_js.ts";
import { ORIGIN_PROPS, Theme, jsxInputGenerator } from "../uix_all.ts"
import { bindToOrigin, getValueInitializer } from "../utils/datex_over_http.ts"
import type { DynamicCSSStyleSheet } from "../utils/css_template_strings.ts";

export type propInit = {datex?:boolean};
export type standaloneContentPropertyData = {type:'id'|'content'|'layout'|'child',id:string};
export type standalonePropertyData = {type:'prop'}
export type standaloneProperties = Record<string, (standaloneContentPropertyData | standalonePropertyData) & {init?:propInit }>;

// deno-lint-ignore no-namespace
export namespace BaseComponent {
    export interface Options {
        class?: string,
        title?: string
    }
}

@template("uix:basecomponent") 
export abstract class BaseComponent<O extends BaseComponent.Options = BaseComponent.Options, ChildElement = JSX.singleOrMultipleChildren> extends HTMLElement implements RouteManager {

    /************************************ STATIC ***************************************/

    protected static stylesheets:string[] =  []

    protected static shadow_stylesheets:string[] =  [
        // global base style
        new URL('../style/elements.css', import.meta.url).toString(),
        new URL('../style/base.css', import.meta.url).toString(),
        new URL('../style/fontawesome.css', import.meta.url).toString()
    ]
    

    static DEFAULT_OPTIONS:BaseComponent.Options = {};
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
            this._dx_files.push(dx_url)
        }
    }

    private static _dx_loaded_resolve?:Function
    private static _dx_loaded_promise?:Promise<void>

    private static async loadModuleDatexImports(){

        // return promise if loaded / loading
        if (this._dx_loaded_promise) return this._dx_loaded_promise;
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
                    if ((await fetch(path)).ok) await this.loadDatexModuleContents(path, valid_dx_files, dx_file_values)
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


        await this.loadDatexImports(this, valid_dx_files, dx_file_values);
        await this.loadDatexImports(this.prototype, valid_dx_files, dx_file_values);

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

    private static async loadDatexImports(target:BaseComponent|typeof BaseComponent, valid_dx_files:string[], dx_file_values:Map<string,[any,Set<string>]>){
        const allowed_imports:Record<string,[string, string]> = target[METADATA]?.[IMPORT_PROPS]?.public

        // try to resolve imports
        for (const [prop, [location, exprt]] of Object.entries(allowed_imports??{})) {

            // try to get from module dx files
            if (location == undefined) {
                let found = false;

                if (!valid_dx_files.length) {
                    if (!this._use_resources) throw new Error(`Could not load export '${exprt}' for component class '${this.name}' - external resources are disabled. Either remove the @NoResources decorator and create a corresponding DATEX file next to the TypeScript module file, or specifiy a different resource location in the @use decorator.`)
                    else if (!this._module) throw new Error(`Could not load export '${exprt}' for component class '${this.name}'. The component module could not be initialized correctly (missing @Component decorator?)`);  // this.module could not be set for whatever reason
                    else throw new Error(`No corresponding DATEX module file found for export '${exprt}' in component class '${this.name}'. Please create a DATEX file '${this._module.replace(/\.m?(ts|js)x?$/, '.dx')} or specifiy a resource location in the @use decorator.`)
                }

                for (const file_data of dx_file_values.values()) {
                    const file_val = file_data[0];
                    if (exprt == "*") {
                        (<any>target)[prop] = file_val;
                        found = true;
                        file_data[1].add(exprt); // remember that export was used
                        logger.debug(`using DATEX export '${exprt}' ${exprt!=prop?`as '${prop}' `:''}in '${this.name}'`);
                    }
                    else if (Datex.DatexObject.has(file_val, exprt)) {
                        (<any>target)[prop] = Datex.DatexObject.get(file_val, exprt);
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
                        (<any>target)[prop] = res;
                    }
                    else {
                        if (Datex.DatexObject.has(<Record<string | symbol, unknown>>res, exprt)) { 
                            (<any>target)[prop] = Datex.DatexObject.get(<Record<string | symbol, unknown>>res, exprt);
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

    private static standalone_loaded = new Set<typeof BaseComponent>();
    private static standalone_class_code = new Map<typeof BaseComponent,string>();

    private static loadStandaloneProps() {
        const scope = this.prototype;

        if (this.standalone_loaded.has(this)) return;
        this.standalone_loaded.add(this);

        this.standaloneMethods = {};
        this.standaloneProperties = {};

        const parentProps = (Object.getPrototypeOf(this).prototype)?.[METADATA]?.[STANDALONE_PROPS]?.public;
        const props:Record<string, string> = scope[METADATA]?.[STANDALONE_PROPS]?.public;
        const originProps:Record<string, propInit> = scope[METADATA]?.[ORIGIN_PROPS]?.public;

        if (!props) return;
        // workaround: [STANDALONE_PROPS] from parent isn't overriden, just ignore
        if (parentProps === props) return;

        for (const name of Object.values(props)) {
            // prototype has methods
            if (scope[<keyof typeof scope>name]) {
                // also bound to origin
                if (originProps?.[name]) {
                    // @ts-ignore
                    scope[<keyof typeof scope>name] = bindToOrigin(scope[<keyof typeof scope>name], undefined, name, originProps[name].datex);
                }
                this.addStandaloneMethod(name, scope[<keyof typeof scope>name]);
            }
            // otherwise, instace property
            else 
            this.addStandaloneProperty(name, originProps?.[name]);
        }
    }

    private static inferredStandaloneMethods:Record<string,string[]> = {
        'onRoute': ['resolveRoute']
    }

    // add methods that run in standalone mode
    private static standaloneMethods:Record<string,Function> = {};
    protected static addStandaloneMethod(name: string, value:Function) {
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
        if (name in (this.prototype[METADATA]?.[ID_PROPS]?.public??{})) {
            const id = this.prototype[METADATA]?.[ID_PROPS]?.public[name];
            // // extract initializer from class source code
            // const classCode = this.toString().replace(/.*{/, '');
            // const propertyCode = classCode.match(new RegExp(String.raw`\b${name}\s*=\s*([^;]*)\;`))?.[1];
            // if (!propertyCode) {
            //     console.log(classCode)
            //     throw new Error("Could not create @standalone property \""+name+"\". Make sure you add a semicolon (;) at the end of the property initialization.")
            // }
            this.standaloneProperties[name] = {type:'id', id, init};
        }
        else if (name in (this.prototype[METADATA]?.[CONTENT_PROPS]?.public??{})) {
            const id = this.prototype[METADATA]?.[CONTENT_PROPS]?.public[name] ?? this.prototype[METADATA]?.[ID_PROPS]?.public[name];
            this.standaloneProperties[name] = {type:'content', id, init};
        }
        else if (name in (this.prototype[METADATA]?.[LAYOUT_PROPS]?.public??{})) {
            const id = this.prototype[METADATA]?.[LAYOUT_PROPS]?.public[name] ?? this.prototype[METADATA]?.[ID_PROPS]?.public[name];
            this.standaloneProperties[name] = {type:'layout', id, init};
        }
        else if (name in (this.prototype[METADATA]?.[CHILD_PROPS]?.public??{})) {
            const id = this.prototype[METADATA]?.[CHILD_PROPS]?.public[name] ?? this.prototype[METADATA]?.[ID_PROPS]?.public[name];
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
            js_code += this.getStandloneMethodContentWithMappedImports(content) + '\n';
        }
        js_code += '}'

        // save static class code in cache
        this.standalone_class_code.set(this,js_code);
        return js_code;
    }

    /**
     * returns the parent class if not BaseComponent
     */
    public static getParentClass(): typeof BaseComponent {
        return Object.getPrototypeOf(this) != HTMLElement ? Object.getPrototypeOf(this) : null;
    }

    /**
     * maps file import paths (datex.get or import) in JS source code to web paths
     */
    private static getStandloneMethodContentWithMappedImports(method:Function){
        return method.toString().replace(/(import|datex\.get) *\((?:'((?:\.(\.)?\/).*)'|"((?:\.(\.)?\/).*)")\)/g, (m,g1,g2,g3,g4)=>{
            const relImport = g2 ?? g4;
            const absImport = new Path(relImport, this._module);

            return `${g1}("${App.filePathToWebPath(absImport)}")`
        })
       
    }

    protected static standaloneEnabled() {
        return !! (
            Object.keys(this.standaloneMethods).length || 
            Object.keys(this.standaloneProperties).length ||
            Object.getPrototypeOf(Object.getPrototypeOf(this)).standaloneEnabled?.()
        )
    }


    protected static getStandaloneConstructor() {
        if (this.name === BaseComponent.name) return indent(4) `
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
    @property declare options:Datex.JSValueWith$<O>; // uses element.DEFAULT_OPTIONS as default options (also for all child elements)

    declare public props: Datex.DatexObjectInit<O> & {children?:ChildElement|ChildElement[]}

    declare $:Datex.Proxy$<this> // reference to value (might generate pointer property, if no underlying pointer reference)
    declare $$:Datex.PropertyProxy$<this> // always returns a pointer property reference

    declare [METADATA]:any
    declare [OPEN_GRAPH]?:OpenGraphInformation

    protected SCROLL_TO_BOTTOM = false;
    protected FORCE_SCROLL_TO_BOTTOM = false;
    protected CONTENT_PADDING = true;

    /**
     * true if component is in standalone mode (UIX library not loaded)
     */
    public standalone = false;

    protected openGraphImageGenerator?: OpenGraphPreviewImageGenerator; // set the custom preview image generator for open graph cards

    protected is_skeleton = false // true if component not yet fully initialized, still displayed as skeleton and not associated with DATEX object

    constructor(options?:Datex.DatexObjectInit<O>) {
        // constructor arguments handlded by DATEX @constructor, constructor declaration only for IDE / typescript
        super()

        // @ts-ignore [INIT_PROPS]
        if (options?.[INIT_PROPS]) options[INIT_PROPS](this);
        // pre-init options before other DATEX state is initialized 
        // (this should not happen when reconstructing, because options are undefined or have [INIT_PROPS])
        else this.initOptions(options);

        // handle special case: was created from DOM
        if (!Datex.Type.isConstructing(this)) {
            if (!(<typeof BaseComponent>this.constructor)[Datex.DX_TYPE]) {
                logger.error("cannot construct UIX element from DOM because DATEX type could not be found")
                return;
            }
            // ignore if currently hydrating static element
            if (this.hasAttribute("data-static")) {
                this.is_skeleton = true;
                logger.debug("hydrating component " + (<typeof BaseComponent>this.constructor)[Datex.DX_TYPE]);
            }
            else {
                // logger.debug("creating " + this.constructor[Datex.DX_TYPE] + " component from DOM");
                return (<Datex.Type>(<typeof BaseComponent>this.constructor)[Datex.DX_TYPE]).construct(this, [], true, true);
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
        this.addStyleSheet(Theme.stylesheet);
        for (const url of (<typeof BaseComponent>this.constructor).shadow_stylesheets??[]) this.addStyleSheet(url);
        // this.disableShadowForDATEX();
    }

    // apply css properties to this element
    public css(property:string, value?:Datex.CompatValue<string|number>):this
    public css(properties:{[property:string]:Datex.CompatValue<string|number>}):this
    public css(properties_object_or_property:{[property:string]:Datex.CompatValue<string|number>}|string, value?:Datex.CompatValue<string|number>):this {
        if (typeof properties_object_or_property == "string") return HTMLUtils.setCSS(this, properties_object_or_property, value)
        else return HTMLUtils.setCSS(this, properties_object_or_property)
    }

    // add css classes
    public cssClass(classes:Datex.CompatValue<string[]>):this
    public cssClass(...classes:string[]):this
    public cssClass(...classes:(Datex.CompatValue<string[]>|string)[]):this {
        return HTMLUtils.setCssClass(this, ...<string[]>classes);
    }

    private handleIdProps(constructed=false){

        const id_props:Record<string,string> = Object.getPrototypeOf(this)[METADATA]?.[ID_PROPS]?.public;
        const content_props:Record<string,string> = Object.getPrototypeOf(this)[METADATA]?.[CONTENT_PROPS]?.public;
        const layout_props:Record<string,string> = Object.getPrototypeOf(this)[METADATA]?.[LAYOUT_PROPS]?.public;
        // only add children when constructing component, otherwise they are added twice
        const child_props:Record<string,string> = constructed ? Object.getPrototypeOf(this)[METADATA]?.[CHILD_PROPS]?.public : undefined;
		bindContentProperties(this, id_props, content_props, layout_props, child_props);
    }


    #datex_lifecycle_ready_resolve?:Function
    #datex_lifecycle_ready = new Promise((resolve)=>this.#datex_lifecycle_ready_resolve = resolve)

    #create_lifecycle_ready_resolve?:Function
    #create_lifecycle_ready = new Promise((resolve)=>this.#create_lifecycle_ready_resolve = resolve)

    #anchor_lifecycle_ready_resolve?:Function
    #anchor_lifecycle_ready = new Promise((resolve)=>this.#anchor_lifecycle_ready_resolve = resolve)

    private static template?:jsxInputGenerator<Element,any,any,any>
    private static style_template?:jsxInputGenerator<CSSStyleSheet,any,any,any>

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
    async defer(handler:Function):Promise<void> {
        await this.anchored;
        await handler(); 
    }

    // default constructor
    @constructor async construct(options?:Datex.DatexObjectInit<O>): Promise<void> {
        // options already handled in constructor

        // handle default component options (class, ...)
        if (this.options?.class) 
            HTMLUtils.setElementAttribute(this, "class", this.options.$.class);

        
        await sleep(0); // TODO: fix: makes sure constructor is finished?!, otherwise correct 'this' not yet available in ShadowDOMComponent.init
        // make sure static component data (e.g. datex module imports) is loaded
        await (<typeof BaseComponent>this.constructor).init();
        this.loadTemplate();
        this.loadDefaultStyle()
        await this.init(true);
        await this.onConstructed?.();
        this.#datex_lifecycle_ready_resolve?.(); // onCreate can be called (required because of async)
    }

    // called when created from saved state
    @replicator async replicate() {
        await sleep(0); // TODO: fix: makes sure constructor is finished?!, otherwise correct 'this' not yet available in child class init
        // make sure static component data (e.g. datex module imports) is loaded
        await (<typeof BaseComponent>this.constructor).init();
        // this.loadTemplate();
        this.loadDefaultStyle()
        await this.init();
        this.#datex_lifecycle_ready_resolve?.(); // onCreate can be called (required because of async)
    }

    /**
     * load template (@UIX.template)
     */
    private loadTemplate() {
        if ((<typeof BaseComponent> this.constructor).template) {
            // don't get proxied options where primitive props are collapsed by default - always get pointers refs for primitive options in template generator
            const templateFn = (<typeof BaseComponent> this.constructor).template!;
            const template = templateFn(Datex.Pointer.getByValue(this.options)?.shadow_object ?? this.options, this);
            HTMLUtils.append(this, template);
        }
    }

    /**
     * load stylesheet from @UIX.style
     */
    private loadDefaultStyle() {
        if ((<typeof BaseComponent> this.constructor).style_template) {
            // don't get proxied options where primitive props are collapsed by default - always get pointers refs for primitive options in template generator
            const templateFn = (<typeof BaseComponent> this.constructor).style_template!;
            const stylesheet = templateFn(Datex.Pointer.getByValue(this.options)?.shadow_object ?? this.options, this) as DynamicCSSStyleSheet;
            if (stylesheet.activate) stylesheet.activate(this.shadowRoot??document);
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
                    options[<keyof typeof options>name] = <Datex.CompatValue<O[keyof O]>> this.attributes[i].value;
                }
            }
        }

        // assign default options as prototype
        this.options = assignDefaultPrototype(default_options, options, clone_option_keys);
    }


    // init for base element (and every element)
    protected async init(constructed = false) {

        // handle shadow root setup
        if (this.shadowRoot) this.initShadowRootStyle();

        // Component style sheets
        const loaders = []
        for (const url of (<typeof BaseComponent>this.constructor).stylesheets??[]) loaders.push(this.addStyleSheet(url));
    
        Datex.Pointer.onPointerForValueCreated(this, ()=>{
            bindObserver(this)
        })

        this.onCreateLayout?.(); // custom layout extensions

        // @id, @content, @layout
        this.handleIdProps(constructed);
   
        // @standlone props only relevant for backend
        if (IS_HEADLESS) this.loadStandaloneProps();

        if (constructed) await this.onConstruct?.();
        await this.onInit?.() // element was constructed, not fully loaded / added to DOM!

        this.enableDefaultOpenGraphGenerator();

        //await Promise.all(loaders); // TODO: await stylesheet loading? leads to errors
    }

    // load standalone props recursively, including all parent classes
    private loadStandaloneProps() {
        let clss = <any>this.constructor;
        do {
            (<typeof BaseComponent>clss).loadStandaloneProps();
        } while ((clss=Object.getPrototypeOf(Object.getPrototypeOf(clss))) && clss != HTMLElement && clss != Element && clss != Object); //  prototype chain, skip proxies inbetween
    }

    private enableDefaultOpenGraphGenerator() {
        if (this[OPEN_GRAPH]) return; // already overridden
        Object.defineProperty(this, OPEN_GRAPH, {
            get() {return new OpenGraphInformation({
                title: this.title,
                description: this.options.description
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
            (<typeof BaseComponent>this.constructor).standaloneEnabled() ||
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
 
        js_code += `const self = querySelector("[data-ptr='${this.getAttribute("data-ptr")}']");\n`
        js_code += `bindPrototype(self, globalThis.UIX_Standalone.${this.constructor.name});\n`

        // init props with current values
        for (const [name, data] of Object.entries((this.constructor as typeof BaseComponent).standaloneProperties)) {
            // init from origin context (via datex)
            if (data.init) {
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
            js_code += `await (function (){return (${(<typeof BaseComponent>this.constructor).getStandloneMethodContentWithMappedImports(handler)})()}).apply(self);\n`;
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
        return this.parentElement == document.body || (this.parentElement instanceof BaseComponent && this.parentElement.isChildPseudoRootElement(this));
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
                if (this.parentElement instanceof BaseComponent) return this.parentElement.assertNextParent(parent);
                else throw "";
            }
        }
        else throw new ValueError(`Now matching parent component of type ${Datex.Type.getClassDatexType(parent)} found`);
    }


    // component becomes full-featured uix component, no longer a skeleton
    public unSkeletonize() {
        if (!this.is_skeleton) return;

        this.is_skeleton = false;
        this.removeAttribute("data-static");

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

    disconnectedCallback() {

        // reset anchor lifecycle
        this.#anchor_lifecycle_ready = new Promise((resolve)=>this.#anchor_lifecycle_ready_resolve = resolve)
        
        // assume next route as new initial route
        this.route_initialized = false;

        // handle child on parent
        if (this.parentElement instanceof BaseComponent) {
            this.parentElement.onChildRemoved(this);
        }
    
    }
    
    // called when added to DOM
    connectedCallback() {
        if (this.is_skeleton) return; // ignore

        // handle child on parent
        if (this.parentElement instanceof BaseComponent) {
            this.parentElement.onChildAdded(this);
        }
        
        // call onAnchor, init with options dialog, etc.; async
        return this.connectedCallbackAsync();
    }

    private async connectedCallbackAsync(){

        await this.#datex_lifecycle_ready; // wait for onConstruct, init

        // // wait until lazy loaded if added to group component
        // if (this.options.lazy_load && this.parentElement instanceof BaseComponent) {
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
        if (!IS_HEADLESS) await this.onDisplay?.();
        await new Promise((r) => setTimeout(r, 0)); // dom changes

        this.#create_lifecycle_ready_resolve?.();
        this.#anchor_lifecycle_ready_resolve?.();
    }

    private route_initialized = false;

    // implements resolveRoute per default, can be overriden for more custom routing behaviour
    public async resolveRoute(route:Path.Route, context:Context):Promise<Path.route_representation> {
        const {Path} = await import("unyt_node/path.ts");

        const delegate = this.routeDelegate??this;

        if (!route?.route) return []; // TODO: should not happen?

        // ignore if route is already up to date
        if (this.route_initialized && Path.routesAreEqual(route, delegate.getInternalRoute())) return route;
        const initial_route = !this.route_initialized;
        this.route_initialized = true;

        const child = await (<BaseComponent<O, ChildElement>>delegate).onRoute?.(route.route[0]??"", initial_route);

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
        if (this == Actions.getActiveDialogElement()) Actions.closeActiveDialog(); // is dialog element, close dialog
        super.remove();
    }

    /** replace this element in parent **/
    public override replaceWith(element:HTMLElement) {
        return this.parentElement?.replaceChild(element, this);
    }

    public observeOption(key:keyof O, handler: (value: unknown, key?: unknown, type?: Datex.Value.UPDATE_TYPE) => void) {
        Datex.Value.observeAndInit(this.options.$$[key], handler, this);
    }
    public observeOptions(keys:(keyof O)[], handler: (value: unknown, key?: unknown, type?: Datex.Value.UPDATE_TYPE) => void) {
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
            url_or_style_sheet = new URL(url_or_style_sheet, (<typeof BaseComponent>this.constructor)._module);
            if (this.style_sheets_urls.includes(url_or_style_sheet.toString())) return; // stylesheet already added

            this.style_sheets_urls.push(url_or_style_sheet.toString());

            // allow fail if only potential module stylesheet
            const allow_fail = (<typeof BaseComponent>this.constructor).module_stylesheets.includes(url_or_style_sheet.toString());
            
            // adopt CSSStylesheet (works if css does not use @import and shadowRoot exists, otherwise use <link>)
            if (adopt && this.shadowRoot) {
                const stylesheet = BaseComponent.getURLStyleSheet(url_or_style_sheet, allow_fail);
                // is sync
                if (stylesheet instanceof <typeof CSSStyleSheet>window.CSSStyleSheet) this.adoptStyle(stylesheet)
                else if (stylesheet) return new Promise<void>(async resolve=>{
                    const s = await stylesheet;
                    if (s) this.adoptStyle(s);
                    resolve();
                })
                // stylesheet might be false, no stylesheet, ignore (error is logged)
            }
            // insert <link>
            else return (async ()=>{
                try {
                    await this.insertStyleSheetLink(url_or_style_sheet);
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


    protected async insertStyleSheetLink(url:URL) {
        if (this.shadowRoot) await addStyleSheetLink(this.shadowRoot, url);
        const tagName = "uix2-"  + String(this.constructor.name).split(/([A-Z][a-z]+)/).filter(t=>!!t).map(t=>t.toLowerCase()).join("-"); // TODO: rename
        return addGlobalStyleSheetLink(url, tagName);
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
    protected adoptStyle(style:string|CSSStyleSheet, __pass_through = false) {
        if (!this.shadowRoot) throw new Error("Cannot adopt style on UIX.BaseComponent - no shadow root");

        // first add base style (this.style)
        if (!__pass_through && !this.#style_sheets.length) this.addBaseStyle();
        
        let stylesheet:CSSStyleSheet;

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

    // return rendered HTML for stylesheets used in this component
    public getRenderedStyle() {
        let html = "";

        // links
		for (let url of this.style_sheets_urls) {
            if (url.toString().startsWith("file://")) {
                // relative web path (@...)
                url = App.filePathToWebPath(url);
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
        html += `<style>${Theme.getDarkThemesCSS().replaceAll("\n","")+'\n'+Theme.getLightThemesCSS().replaceAll("\n","")}</style>`

        return html;
    }
    
    /** end - shadow dom specific methods */


    // @implement child is on top edge of parent, let header behave as if child was actual root element
    protected isChildPseudoRootElement(child: ChildElement){
        return false;
    }

    protected routeDelegate?: BaseComponent; // delegate that handles all routes for this component
    /** called to get the current route of the component (child route) */
    getInternalRoute():string[] {
        const identifier = this.getRouteIdentifier();
        if (typeof identifier == "string") return [identifier]
        else return [];
    }

    protected getRouteIdentifier():string|undefined|void {}

    /** called when a route is requested from the component, return element matching the route identifier or true if route was handled */
    protected onRoute?(identifier:string, is_initial_route:boolean):Promise<void|BaseComponent|boolean>|void|BaseComponent|boolean

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