// deno-lint-ignore-file no-async-promise-executor
import { constructor, Datex, property, props, replicator, template, boolean, get} from "unyt_core"
import { Elements } from "../elements/main.ts"
import { Theme } from "../base/theme.ts"
import { Types } from "../utils/global_types.ts"
import { logger, unsaved_components } from "../utils/global_values.ts"
import { addStyleSheetLink, PlaceholderCSSStyleDeclaration } from "../utils/css_style_compat.ts"
import { assignDefaultPrototype } from "../utils/utils.ts"
import { HTMLUtils } from "../html/utils.ts"
import { Utils } from "../base/utils.ts"
import { Actions } from "../base/actions.ts"
import { Handlers } from "../base/handlers.ts"
import { Class, DX_IGNORE, Logger, METADATA, ValueError } from "unyt_core/datex_all.ts"
import { I, S } from "../uix_short.ts"
import { DEFAULT_BORDER_SIZE, IS_HEADLESS } from "../utils/constants.ts"
import { Clipboard } from "../base/clipboard.ts"
import type { Group } from "./group.ts"
import { Components } from "./main.ts"
import { CHILD_PROPS, CONTENT_PROPS, ID_PROPS, IMPORT_PROPS, LAYOUT_PROPS, ORIGIN_PROPS, STANDALONE_PROPS } from "../base/decorators.ts";
import { bindObserver } from "../html/datex_binding.ts";
import { Path } from "../utils/path.ts";
import { RouteManager } from "../html/entrypoints.ts";
import { Context } from "../base/context.ts";
import { makeScrollContainer, scrollContext, scrollToBottom, scrollToTop, updateScrollPosition } from "../standalone/scroll_container.ts";
import { OpenGraphInformation, OpenGraphPreviewImageGenerator, OPEN_GRAPH } from "../base/open-graph.ts";
import { app } from "../app/app.ts";
import { bindContentProperties } from "../standalone/bound_content_properties.ts";
import { propInit, standaloneContentPropertyData, standaloneProperties } from "./UIXComponent.ts";
import { indent } from "../utils/indent.ts";
import { serializeJSValue } from "../utils/serialize_js.ts";
import { bindToOrigin, getValueInitializer } from "../utils/datex_over_http.ts"
import { convertToWebPath } from "../app/utils.ts";


// deno-lint-ignore no-namespace
/**
 * @deprecated Please use UIXComponent
 */
export namespace Base {
    export interface Options extends Elements.Base.Options {
        vertical_align?:Types.VERTICAL_ALIGN
        horizontal_align?:Types.HORIZONTAL_ALIGN
        portrait_mode?: boolean

        enable_drop?: boolean

        enable_ctx?: boolean|'inherit' // enable context menu?
        default_ctx?: boolean // add default context menu?

        hidden?: boolean // is element hidden at the beginning, before explictly shown with show()?
        lazy_load?: boolean // don't call onCreate until element is focused

        enable_routes?: boolean // automatically handles url routes (for children)

        generate_open_graph?: boolean, // enable auto generated open graph meta information for this component

        border_radius?: number;
        border_tl_radius?: number
        border_tr_radius?: number
        border_bl_radius?: number
        border_br_radius?: number

        fill_border?: boolean // allow children to extend over onto the border
        fill_content?: boolean // html_element 100% height, 100%width

        style?:string|Record<string,string|number> // style attribute

        bg_color?: string // background color
        background?: string // general background
        border_color?: string // border color
        border?: number|boolean // show border or not / border size
        border_left?: number|boolean // show border_left or not / border size
        border_right?: number|boolean // show border_right or not / border size
        border_bottom?: number|boolean // show border_bottom or not / border size
        border_top?: number|boolean // show border_top or not / border size

        text_color?: string // custom text color
        text_color_light?: string // custom text color
        text_color_highlight?: string // custom text color

        accent_color?: string // tint color, e.g. for background tint
        title_color?: string // title color (e.g. for TabGroup)

        padding?:number // = padding on the inner css "grid"/"html" div
        padding_top?:number
        padding_bottom?:number
        padding_left?:number
        padding_right?:number
        
        overflow?: boolean // allow content overflow
        scroll_content?: boolean, // create content as scroll container

        identifier?:string // unique identifier for this component
        title?:string // title, e.g. for tabs
        description?: string, // description, e.g. used by open graph preview
        short_title?: string // shorter title
        icon?:string // icon as html
        group?:string // group identifier

        collector?: Group // element that collects elements spawned from this element

        temporary?:boolean // if true, the object is not saved in JSON state
        removable?:boolean // indicates if the user should be able to delete this element (e.g., in a TabGroup)
        
        responsive?: boolean // handle element with responsive layout changes (must be implemented for this element)
        clickable?: boolean // handle clicks on element in onClick

        // component state (_) - should not be set manually when creating a new instance
        _scroll_x?:number // current scroll x position
        _scroll_y?:number // current scroll y position

    }
}


@template("uix:component")
/**
 * @deprecated Please use UIXComponent
 */
export abstract class Base<O extends Base.Options = Base.Options> extends Elements.Base implements RouteManager {

    static DEFAULT_OPTIONS:Base.Options = {
        bg_color: Theme.getColorReference('bg_default'),
        accent_color: Theme.getColorReference('accent'),
        vertical_align: Types.VERTICAL_ALIGN.CENTER,
        horizontal_align: Types.HORIZONTAL_ALIGN.CENTER,
        border_radius: 10,
        border: true,
        enable_drop: true,
        enable_ctx: true,
        default_ctx: true,
        removable: true,
        fill_content:true
    };

    public static readonly DEFAULT_CONSTRAINTS:Types.component_constraints = {
        gx: 0,
        gy: 0,
        gw: 1,
        gh: 1,
        margin: 0,
        draggable: true,
        resizable: true
    }

    // can be overridden by a class
    static INITIAL_CONSTRAINTS:Types.component_constraints
    static CLONE_OPTION_KEYS: Set<string> // list of all default option keys that need to be cloned when options are initialized (non-primitive options)
    protected static RESPONSIVE_TRIGGER_WIDTH = 600;


    // options + constraints
    @property declare options:Datex.JSValueWith$<O>; // uses element.DEFAULT_OPTIONS as default options (also for all child elements)
    @property constraints!:Datex.JSValueWith$<Types.component_constraints>

    declare public props: O

    declare $:Datex.Proxy$<this> // reference to value (might generate pointer property, if no underlying pointer reference)
    declare $$:Datex.PropertyProxy$<this> // always returns a pointer property reference

    options_props: Datex.ObjectWithDatexValues<O>
    constraints_props: Datex.ObjectWithDatexValues<Types.component_constraints>

    protected SCROLL_TO_BOTTOM = false;
    protected FORCE_SCROLL_TO_BOTTOM = false;
    protected CONTENT_PADDING = true;

    protected openGraphImageGenerator?: OpenGraphPreviewImageGenerator; // set the custom preview image generator for open graph cards

    get shadow_root() {
        if (!this.shadowRoot) {
            this.attachShadow({mode: 'open'});
            (<any>this.shadowRoot)![DX_IGNORE] = true;
        }
        return this.shadowRoot!;
    }

    content_container:HTMLElement; // inner container for element specific and custom content
    content:HTMLElement; // all content goes here
    get html_element() {return this.content} // legacy backwards compatibility TODO remove at some point

    protected is_skeleton = false // true if component not yet fully initialized, still displayed as skeleton and not associated with DATEX object

    /**
     * @deprecated Please use UIXComponent
     */
    constructor(options?:Datex.DatexObjectInit<O>, constraints?:Datex.DatexObjectInit<Types.component_constraints>) {
        // constructor arguments handlded by DATEX @constructor, constructor declaration only for IDE / typescript
        super(null)
        
        // handle special case: was created from DOM
        if (!Datex.Type.isConstructing(this)) {
            if (!this.constructor[Datex.DX_TYPE]) {
                logger.error("cannot construct UIX element from DOM because DATEX type could not be found")
                return;
            }
            // ignore if currently hydrating static element
            if (this.hasAttribute("data-static")) {
                this.is_skeleton = true;
                logger.debug("hydrating component " + this.constructor[Datex.DX_TYPE]);
            }
            else {
                // logger.debug("creating " + this.constructor[Datex.DX_TYPE] + " component from DOM");
                return (<Datex.Type>this.constructor[Datex.DX_TYPE]).construct(this, [], true, true);
            }

        }
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
    @constructor async construct(options?:Datex.DatexObjectInit<O>, constraints?:Types.component_constraints): Promise<void>|void{

        const default_options = (<any>this.constructor).DEFAULT_OPTIONS;
        const clone_option_keys = (<any>this.constructor).CLONE_OPTION_KEYS;
        const initial_constraints = (<any>this.constructor).INITIAL_CONSTRAINTS;

        // get options from html attributes
        if (!options) options = <O>{};            
        for (let i=0;i < this.attributes.length; i++) {
            const name = this.attributes[i].name;
            // don't override provided options object
            if (!(name in options)) {
                // json (number, array, ...) - for attributes written in html (strings per default, must be converted to the right type)
                try {
                    options[name] = JSON.parse(this.attributes[i].value);
                } 
                // string
                catch (e) {
                    options[name] = this.attributes[i].value;
                }
            }
        }

        // assign default options as prototype
        this.options = assignDefaultPrototype(default_options, options, clone_option_keys);

        // copy initial constraints, use Base.DEFAULT_CONSTRAINTS as prototype (TODO change, similar to options with individual prototype types?)
        this.constraints = Object.assign(Object.create(Base.DEFAULT_CONSTRAINTS), {...initial_constraints, ...constraints});
        
        await this.init(true);
        await this.onConstructed?.();
        this.#datex_lifecycle_ready_resolve?.(); // onCreate can be called (required because of async)
    }

    // called when created from saved state
    @replicator async replicate():Promise<void>|void{
        await this.init();
        this.#datex_lifecycle_ready_resolve?.(); // onCreate can be called (required because of async)
    }


    // init for base element (and every element)
    private async init(constructed = false) {

        Datex.Pointer.onPointerForValueCreated(this, ()=>{
            bindObserver(this)
        })

        this.options_props = <Datex.ObjectWithDatexValues<O>> props(this.options); // TODO typescript correct types
        this.constraints_props = <Datex.ObjectWithDatexValues<Types.component_constraints>> props(this.constraints); 

        // create dom (shadow_root)
        // this.shadow_root = this.shadowRoot ?? this.attachShadow({mode: 'open'});
        
        // Component style sheets
        const loaders = []
        for (const url of (<typeof Base>this.constructor).stylesheets??[]) loaders.push(this.addStyleSheet(url));

        this.addStyleSheet(Theme.stylesheet);
        
        this.content_container = this.shadow_root.querySelector('.content-container') ?? document.createElement('div');
        this.content_container.classList.add("content-container");
        this.content_container.id = "content_container";

        this.content_container.style.justifyContent = this.options.vertical_align||"";
        this.content_container.style.alignItems = this.options.horizontal_align||"";

        this.content = document.createElement('slot');
        this.content.classList.add("content");
        this.content.id = "content";

        if (this.options.fill_content) this.content.classList.add("fill");

        if (this.options.overflow) {
            this.content.style.overflow = "visible";
            this.content_container.style.overflow = "visible";
        }

        if (this.options.scroll_content) {
            this.content.style.height = "auto"
            this.content_container.append(this.makeScrollContainer(this.content));
            this.addStandaloneHandler(async ()=>{
                const {enableScrollContainer} = await import("uix/standalone/scroll_container.ts");
                enableScrollContainer(this.shadowRoot!.querySelector(".uix-scrollbar-container")!)
            })
        }
        else this.content_container.append(this.content);

        this.shadow_root.append(this.content_container);

        this.observeOptions(['border_radius', 'border_tl_radius', 'border_tr_radius', 'border_bl_radius', 'border_br_radius'], this.updateBorderRadius)
        this.observeOptions(['border_color', 'border_top', 'border_bottom', 'border_left', 'border_right', 'bg_color'], this.updateBorders)
        this.observeOptions(['padding', 'padding_left', 'padding_right', 'padding_right', 'padding_bottom'], this.updatePadding)
        this.observeConstraints(['margin', 'margin_left', 'margin_right', 'margin_right', 'margin_bottom'], this.updateMargin)

        HTMLUtils.setCSSProperty(this.content_container, 'background', this.options.background ? this.options.$$.background : this.options.$$.bg_color)
        HTMLUtils.setCSSProperty(this.content_container, 'color', this.options.$$.text_color)

        HTMLUtils.setCSSProperty(this.content_container, '--current_text_color', this.options.$$.text_color)
        HTMLUtils.setCSSProperty(this.content_container, '--current_text_color_highlight', this.options.$$.text_color_highlight)
        HTMLUtils.setCSSProperty(this.content_container, '--current_text_color_light', this.options.$$.text_color_light)


        // listeners & observers
        this.addEventListener("mousedown", (e)=>{
            this.handleFocus();
            // if (global_states.meta_pressed) {
            //     Actions.toggleFullscreen(this, false)
            // }
            e.stopPropagation()
        })

        if (this.options.clickable) {
            this.addEventListener("click", (e)=>{
                this.onClick?.();
            })
        }

        this.createDropHandler();

        // context menu
        if (this.options.enable_ctx === true) {
            let custom_ctx_menu = this.createContextMenu();
            if (this.options.default_ctx) this.generated_context_menu = {...custom_ctx_menu, _:"space", ...this.copy_context_menu, _2:'space', ...this.default_context_menu}
            else this.generated_context_menu = {...custom_ctx_menu};
            Handlers.contextMenu(this.content_container, this.generated_context_menu)
        }
        // ignore, inherit
        else if (this.options.enable_ctx === "inherit") {

        }
        // block contextmenu
        else this.addEventListener("contextmenu", (e)=>{e.preventDefault();e.stopPropagation()})

        if (this.options.hidden) this.hide();

        // unsaved changes for this element? (file editors, ...)
        this.onFlagAdded("dirty", ()=>{
            unsaved_components.add(this);
        })
        this.onFlagRemoved("dirty", ()=>{
            unsaved_components.delete(this);
        })

        if (this.constraints.dynamic_size) this.setSizeDynamic();

        this.onCreateLayout?.(); // custom layout extensions

        // @UIX.id
        this.handleIdProps(constructed);

        // this.applyStyle(); // custom style
        if (this.options.style) HTMLUtils.setCSS(this, this.options.style)

        await (<typeof Base>this.constructor).loadModuleDatexImports();
        // @standlone props only relevant for backend
        if (IS_HEADLESS) this.loadStandaloneProps();

        if (constructed) await this.onConstruct?.();
        await this.onInit?.() // element was constructed, not fully loaded / added to DOM!

        if (this.options.generate_open_graph!==false) this.enableDefaultOpenGraphGenerator();

        //await Promise.all(loaders); // TODO: await stylesheet loading? leads to errors
    }


    // load standalone props recursively, including all parent classes
    private loadStandaloneProps() {
        let clss = <any>this.constructor;
        do {
            (<typeof Base>clss).loadStandaloneProps();
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

    public applyStyle() {
        Theme.applyStyle(this, this.options.style);
    }

    public appendContent(...elements:(HTMLElement|string)[]) {
        for (const el of elements) {
            this.content.append(el)
        }
    }

    // guessing module stylesheets, get added to normal stylesheets array after successful fetch
    private static _module_stylesheets:string[] = []
    private static _dx_files:string[] = []

    private static stylesheets:string[] =  [

        // global base style
        new URL('../style/elements.css', import.meta.url).toString(),
        new URL('../style/base.css', import.meta.url).toString(),
        new URL('../style/fontawesome.css', import.meta.url).toString(),

        // components style
        new URL('./base.css', import.meta.url).toString()
    ]


    private static _module:string
    private static _use_resources: boolean;


    get portrait_mode():Datex.Value<boolean> {
        if (!('portrait_mode' in this.options)) this.options.$.portrait_mode = boolean();
        return this.options.$.portrait_mode!;
    }

    // is_initial_layout when size still 0, before added to DOM -> initialize Layout Normal
    protected updateResponsive(force_update = false, is_initial_layout = false){

        this.onResize?.();

        // switch to normal mode
        if (is_initial_layout || (this.width >= Base.RESPONSIVE_TRIGGER_WIDTH && (force_update||this.portrait_mode.val != false))){
            this.portrait_mode.val = false;
            const changed = this.onLayoutModeNormal?.();
            if (changed===false) this.portrait_mode.val = true; // revert back, layout change was cancelled
        }
        // switch to portrait mode
        else if (this.width < Base.RESPONSIVE_TRIGGER_WIDTH && (force_update||this.portrait_mode.val != true)) {
            this.portrait_mode.val = true;
            const changed = this.onLayoutModePortrait?.();
            if (changed===false) this.portrait_mode.val = false;  // revert back, layout change was cancelled
        }

    }

    // list of all adopted stylesheets for this element / shadow DOM
    #style_sheets:CSSStyleSheet[] = [];
    #pseudo_style = PlaceholderCSSStyleDeclaration.create();
    #style_sheets_urls:string[] = [];

    // get style_sheets_urls () {return this.#style_sheets_urls}
    // get style_sheets () {return this.#style_sheets}

    // return rendered HTML for stylesheets used in this component
    public getRenderedStyle() {
        let html = "";

        // for (let sheet of this.constructor._module_stylesheets) {
        //     if (sheet.toString().startsWith("file://") && rel_path) {
        //         // relative web path (@...)
        //         sheet = new Path(sheet).getAsRelativeFrom(rel_path).replace(/^\.\//, "/@");
        //     }
        //     html += `<link rel=stylesheet href="${sheet}">`;
        // }

        // links
		for (let url of this.#style_sheets_urls) {
            if (url.toString().startsWith("file://")) {
                // relative web path (@...)
                url = convertToWebPath(url);
            }
            html += `<link rel=stylesheet href="${url}">`;
        }

        // noscript fallback style
        html += `<noscript><link rel="stylesheet" href="https://dev.cdn.unyt.org/uix/style/noscript.css"></noscript>`
        // stylesheets
        // for (const sheet of this.#style_sheets) {
        //     // workaround for server side stylesheet
        //     if (sheet._cached_css) html += `<style>${sheet._cached_css}</style>`
        //     // normal impl
        //     else {
        //         html += `<style>`
        //         for (const rule of sheet.cssRules) {
        //             html += rule.cssText;
        //         }
        //         html += `</style>`
        //     }
        //     break; // only add first style (:host:host style)
        // }

        if (this.#adopted_root_style) {
            html += `<style>${this.#adopted_root_style.cssText}</style>`
        }
        else if (this.#pseudo_style) {
            html += `<style>:host:host{${this.#pseudo_style.cssText}}</style>`
        }

        // add theme classes
        html += `<style>${UIX.Theme.getDarkThemesCSS().replaceAll("\n","")+'\n'+UIX.Theme.getLightThemesCSS().replaceAll("\n","")}</style>`

        return html;
    }


    // // adopted constructed stylesheet for shadow root
    #adopted_root_style?:CSSStyleDeclaration 

    private static style_sheets_by_url = new Map<string, CSSStyleSheet|false>()
    private static style_sheets_loaders = new Map<string, Promise<CSSStyleSheet|false>>()

    /**
     * add a custom stylesheet as a <link> or adopted stylesheet to this component
     * @param url_or_style_sheet url to css file, css text or CSSStyleSheet
     * @param adopt if true, the style is added to the shadow root adoptedStyleSheets, otherwise (if an url is provided), the style is added as a <link>
     */
    public addStyleSheet(url:string|URL, adopt?:boolean):Promise<void>|void
    public addStyleSheet(style_sheet:CSSStyleSheet):Promise<void>|void
    public addStyleSheet(url_or_style_sheet:string|CSSStyleSheet|URL, adopt = true):Promise<void>|void {

        if (typeof url_or_style_sheet == "string" || url_or_style_sheet instanceof URL) {
            url_or_style_sheet = new URL(url_or_style_sheet, this.constructor._module);
            this.#style_sheets_urls.push(url_or_style_sheet.toString());
            
            // adopt CSSStylesheet (works if css does not use @import)
            if (adopt) {
                const stylesheet = Base.getURLStyleSheet(url_or_style_sheet, (<typeof Base>this.constructor)._module_stylesheets.includes(url_or_style_sheet.toString()));
                // is sync
                if (stylesheet instanceof <typeof CSSStyleSheet>window.CSSStyleSheet) this.adoptStyle(stylesheet)
                else if (stylesheet) return new Promise<void>(async resolve=>{this.adoptStyle(await stylesheet);resolve();})
                // stylesheet might be false, no stylesheet, ignore (error is logged)
            }
            // insert <link>
            else return addStyleSheetLink(this.shadow_root, url_or_style_sheet);
        }

        else if (url_or_style_sheet instanceof <typeof CSSStyleSheet>window.CSSStyleSheet){
            this.adoptStyle(url_or_style_sheet)
        }
    }

    /**
     * Get a stylesheet from an url or from cache
     * @param url URL or url string to css file
     * @returns the created stylesheet
     */
    private static getURLStyleSheet(url:string|URL, allow_fail = false):Promise<CSSStyleSheet|false>|CSSStyleSheet|false {
        const url_string = url.toString();

        // already loaded
        if (Base.style_sheets_by_url.has(url_string)) {
            return Base.style_sheets_by_url.get(url_string)!;
        } 
        // there's already an active loader - await
        else if (Base.style_sheets_loaders.has(url_string)) {
            return Base.style_sheets_loaders.get(url_string)!;
        }
        // create new (fetch stylesheet)
        else {
            const loader = new Promise<CSSStyleSheet|false>(async resolve=>{
                const stylesheet = await Base.loadURLStyleSheet(url_string, allow_fail);
                resolve(stylesheet);
                Base.style_sheets_loaders.delete(url_string); // remove loader
            })
            Base.style_sheets_loaders.set(url_string, loader);
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
    
            Base.style_sheets_by_url.set(url, stylesheet) // save
            logger.debug("css stylesheet loaded: " + url)

            return stylesheet;
        }

        else {
            Base.style_sheets_by_url.set(url, false) // save invalid stylesheet
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
        // find matching .css and .dx files by name
        this.findModuleBoundStylesheets(); 
        

        const loaders:Promise<CSSStyleSheet|false>[] = [];

        for (const url of this.stylesheets) {
            // add to loaders if not already loading/loaded
            if (!Base.style_sheets_by_url.has(url) && !Base.style_sheets_loaders.has(url)) {
                loaders.push(<Promise<CSSStyleSheet|false>>Base.getURLStyleSheet(url, this._module_stylesheets.includes(url)))
            }
        }

        return Promise.all(loaders)
    }

    /**
     * find the x.css file matching the x.ts module file of this component (if specified)
     */
    private static findModuleBoundStylesheets(){
        if (this._use_resources) {
            const css_url = this._module.replace(/\.m?(ts|js)x?$/, '.css');
            this._module_stylesheets = [...this._module_stylesheets]; // create new module stylesheets are for this class
            this._module_stylesheets.push(css_url); // remember as module stylesheets
            const url_string = new URL(css_url).toString();
            if (!this.stylesheets.includes(url_string)) this.stylesheets.push(url_string) // add to normal stylesheets
        }
    }

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


        // for (const [path, [file_val, used]] of dx_file_values) {
        //     if (!file_val) continue;
        //     for (const [exprt] of Datex.DatexObject.entries(file_val)) {
        //         if (!used.has(<string> exprt) && !used.has('*')) logger.warn(`unused DATEX export '${exprt}' in ${path}`);
        //     }
        // }

        // resolve load promise
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

    private static async loadDatexImports(target:object, valid_dx_files:string[], dx_file_values:Map<string,[any,Set<string>]>){
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
                        target[prop] = file_val;
                        found = true;
                        file_data[1].add(exprt); // remember that export was used
                        logger.debug(`using DATEX export '${exprt}' ${exprt!=prop?`as '${prop}' `:''}in '${this.name}'`);
                    }
                    else if (Datex.DatexObject.has(file_val, exprt)) {
                        target[prop] = Datex.DatexObject.get(file_val, exprt);
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
                        target[prop] = res;
                    }
                    else {
                        if (Datex.DatexObject.has(res, exprt)) { 
                            target[prop] = Datex.DatexObject.get(res, exprt);
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
    private static standalone_loaded = new Set<typeof Base>();
    private static standalone_class_code = new Map<typeof Base,string>();

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

    protected static getStandaloneConstructor() {
        if (this.name === Base.name) return indent(4) `
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
                js_code += `this["${name}"] = ${this.getSelectorCode(data, 'this')}\n`
            }
            // @content, @child, @layout - find with selector
            else {
                js_code += `this["${name}"] = ${this.getSelectorCode(data, 'this')};\n`;
            } 
        }
        return js_code;
    }

    /**
     * returns the parent class if not BaseComponent
     */
    public static getParentClass(): typeof Base {
        const proto = Object.getPrototypeOf(this);
        return (proto != HTMLElement && proto.name !== "Base") ? proto : null;
    }

    /**
     * maps file import paths (datex.get or import) in JS source code to web paths
     */
    private static getStandloneMethodContentWithMappedImports(method:Function){
        return method.toString().replace(/(import|datex\.get) *\((?:'((?:\.(\.)?\/).*)'|"((?:\.(\.)?\/).*)")\)/g, (m,g1,g2,g3,g4)=>{
            const relImport = g2 ?? g4;
            const absImport = new Path(relImport, this._module);

            return `${g1}("${convertToWebPath(absImport)}")`
        })
       
    }


    protected static getSelectorCode(propData:standaloneContentPropertyData, self: string) {
        // direct child
        if (propData.type == "child") 
            return `${self}.querySelector("#${propData.id}")`;
        // shadow root child
        else 
            return `${self}.shadowRoot.querySelector("#${propData.id}")`;
    }

    // used in render.ts
    protected standaloneEnabled() {
        return !! (
            (<typeof Base>this.constructor).standaloneEnabled() ||
            this.standalone_handlers.size
        )
    }

    protected static standaloneEnabled() {
        return !! (
            Object.keys(this.standaloneMethods).length || 
            Object.keys(this.standaloneProperties).length ||
            Object.getPrototypeOf(Object.getPrototypeOf(this)).standaloneEnabled?.()
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
        for (const [name, data] of Object.entries((this.constructor as typeof Base).standaloneProperties)) {
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
            js_code += `await (function (){return (${(<typeof Base>this.constructor).getStandloneMethodContentWithMappedImports(handler)})()}).apply(self);\n`;
        }
        
        // standalone constructor + lifecycle
        js_code += `self._standalone_construct();\n`
        js_code += `self.onDisplay?.();`
        return js_code;
    }


    // wait until static (css) and dx module files loaded
    public static async init() {
        await this.loadModuleDatexImports();
    }

    /**
     * Add a style to the shadow root adoptedStyleSheets
     * @param style style text or CSSStyleSheet
     */
    protected adoptStyle(style:string|CSSStyleSheet, __pass_through = false) {
        // first add base style (this.style)
        if (!__pass_through && !this.#style_sheets.length) this.addBaseStyle();
        
        let stylesheet:CSSStyleSheet;

        if (style instanceof window.CSSStyleSheet) stylesheet = style;
        else {
            stylesheet = new window.CSSStyleSheet();
            stylesheet.replaceSync(style);
        }
        this.#style_sheets.push(stylesheet);
        this.shadow_root.adoptedStyleSheets = [...this.#style_sheets]; // this.#style_sheets

        return stylesheet;
    }

    /**
     * add a default adopted CSSStyleSheet which is referenced by this.style
     */
    private addBaseStyle(){
        this.adoptStyle(":host:host {}", true); // use ':host:host' for higher specificity (should behave like inline style)
    }

    public get _original_style() {
        return super.style;
    }

    // returns style of this element, if shadow_root not yet attached to a document (styleSheets not available, see https://github.com/WICG/webcomponents/issues/526)
    public override get style():CSSStyleDeclaration {
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
                        if (prop in target && prop[0] !== '_') {
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
            else if (window.CSSStyleSheet.IS_COMPAT) {
                this.#adopted_root_style = new CSSStyleDeclaration();
            }

            // normal
            else this.#adopted_root_style = (<CSSStyleRule>stylesheet.cssRules[0]).style;
        }

        // return adopted_root_style or pseudo style placeholder
        return this.#adopted_root_style ?? <CSSStyleDeclaration>this.#pseudo_style;
    }

    #focusable = false;

    public get focusable(){
        return this.#focusable;
    }
    public set focusable(focusable:boolean){
        this.#focusable = focusable;
        if (this.#focusable) this.content_container.setAttribute("tabindex", "-1")
        else this.content_container.removeAttribute("tabindex")
    }


    // is element the current top parent (root) element
    public get is_root_element(){
        return this.parentElement == document.body || this.parent?.isChildPseudoRootElement(this);
    }
    


    public updateSize = true; // disable to prevent size updates

    // protect the content area with a cover div when resizing elements to prevent triggering mousemove/mouseover events
    protected protect_content_area = false 
    public edit_protector:HTMLDivElement

    public generated_context_menu;

    // boolean states
    protected precise_edit: boolean = false;
    in_focus: boolean = false;
    edit_mode: boolean = false;

    #created = false; // set to true if onCreate has been called
    is_hidden = false; // set to true if currently invisible

    edit_areas:Partial<Record<(typeof Types.AREA)[keyof typeof Types.AREA], HTMLElement>> = {}
    edit_helpers = {}

    // the parent element (has to be a ComponentGroup)
    parent:Group;
    previousParent:HTMLElement


    // get parent element if type matches, else throw error
    assertParent<P extends Group>(parent: Class<P>):P {
        if (this.parent instanceof parent) return this.parent;
        else if (!parent) new ValueError(`Component should have a parent of type ${Datex.Type.getClassDatexType(parent)}, but has none`);
        else throw new ValueError(`Component parent has type ${Datex.Type.ofValue(this.parent)}, but should be ${Datex.Type.getClassDatexType(parent)}`);
    }

    // get any parent element (recursive), return first match
    assertNextParent<P extends Group>(parent: Class<P>):P {
        if (this.parent) {
            try {
                return this.assertParent(parent);
            }
            catch (e) {
                return this.parent.assertNextParent(parent);
            }
        }
        else throw new ValueError(`Now matching parent component of type ${Datex.Type.getClassDatexType(parent)} found`);
    }

    /************/


    // component becomes full-featured uix component, no longer a skeleton
    public unSkeletonize() {
        if (!this.is_skeleton) return;

        this.is_skeleton = false;
        this.removeAttribute("data-static");

        // continue component lifecycle
        const type = Datex.Type.ofValue(this);
        type.initProperties(this, {options:$$({}), constraints:$$({})});
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


        // if (this.is_skeleton) return; // ignore

        // const parent_is_uix = this.parentElement instanceof Base;
        // const prev_parent_is_uix = this.previousParent instanceof Base;

        // TODO also ignore if previous parent was document.body (or a non uix element?!)

        // console.log("disconnected",this,this.parentElement)
        //this.parent?.unlinkElement(this);
    }

    
    // called when added to DOM
    connectedCallback() {
        if (this.is_skeleton) return; // ignore

        const parent_is_uix = this.parentElement instanceof Base;
        
        //this.reloadStyle(); // required to get current style object from shadow root... gets created new on append?!?!

        // has UIX Element parent?
        if (parent_is_uix) this.parent = <Group>this.parentElement;

        // edit areas
        this.addEditAreas();
        // content protector area
        if (this.protect_content_area) {
            this.edit_protector = document.createElement("div");
            this.edit_protector.classList.add("edit-protector");
            this.edit_protector.style.display = "none";
            this.shadow_root.append(this.edit_protector);
        }

        // handle child on parent
        this.parent?.handleNewElement(this);
        this.parent?.adjustChildLayout(this);

        // is root element?
        this.updateRootLayout();

        // call onAnchor, init with options dialog, etc.; async
        return this.connectedCallbackAsync();
    }

    private async connectedCallbackAsync(){

        await this.#datex_lifecycle_ready; // wait for onConstruct, init

        // wait until lazy loaded if added to group component
        if (this.options.lazy_load && this.parent instanceof Group) {
            // notify parent about anchor
            this.parent?.handleChildAnchor(this);
            // wait until first focus
            await this.#first_focus
            this.logger.info("Lazy loading")
        }

        // has all required options? first init manually?
        if (!this.hasValidOptions()){
            logger.error("not all required options");
            try {
                let new_options = await this.showInitDialog();
                console.log(new_options)
                for (let [key, value] of Object.entries(new_options)) this.options[key] = value;   
            }
            catch(e) {
                console.error(e);
                return
            }
        }

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

        // notify parent about anchor
        this.parent?.handleChildAnchor(this);

        // after everything is loaded, handle responsive changes
        if (new_create) {
            if (this.options.responsive) {
                this.updateResponsive(false, true);
    
                // update responsive on resize
                if (!IS_HEADLESS) {
                    new ResizeObserver(() => {
                        this.updateResponsive();
                    }).observe(this);
                }
            }
        }
    
        // this.updateResponsive(false, true);

        if (!IS_HEADLESS) await this.onDisplay?.();

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

        const child = await delegate.onRoute?.(route.route[0]??"", initial_route);

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


    // anchor, if no parent_element is specfied, it is appended to the body
    public anchor(parent_element?:HTMLElement) {  
        // add to body if no parent element provided
        if (parent_element==null) parent_element = document.body;
        parent_element.append(this);
    }


    // Fullscreen handling
    private exit_fullscreen_handlers = new Set<()=>void>()
    private go_fullscreen_handlers   = new Set<()=>void>()
    public goFullscreen(actual_full_screen = true):Promise<void>{
        return Actions.goFullscreen(this, actual_full_screen);
    }
    public exitFullScreen():Promise<void>{
        return Actions.exitFullscreen()
    }
    public toggleFullscreen(actual_full_screen = true):Promise<boolean>{
        return Actions.toggleFullscreen(this, actual_full_screen)
    }
    public onExitFullScreen(handler:()=>void){
        this.exit_fullscreen_handlers.add(handler)
    }
    public onGoFullScreen(handler:()=>void){
        this.go_fullscreen_handlers.add(handler)
    }

    // call when element gone/exited fullscreen
    public handleGoFullScreen(){
        for(let h of this.go_fullscreen_handlers) h()
    }
    public handleExitFullScreen(){
        for(let h of this.exit_fullscreen_handlers) h()
    }


    #logger?:Logger
    protected get logger(){
        return this.#logger = this.#logger ?? new Logger(this);
    }


    /** component header */

    #header?:HTMLElement
    public get header(){return this.#header;}
    public set header(header:HTMLElement){
        if (this.#header) this.#header.remove(); // remove previous header
        this.#header = header;
        this.#header.id = "header"; // overwrite element id to #header
        this.content_container.prepend(this.#header)
        this.updateRootLayout();
    }

    // update header layout (overlay)
    private updateRootLayout(){
        if (this.is_root_element) {
            this.content_container.setAttribute("root","true");
            this.content_container.style.boxShadow = "none" // no outer border on window TODO: only if fills window?
            Actions.setAppBackground(this.bg_color, false)
            Theme.onModeChange(()=>{
                if (this.is_root_element) Actions.setAppBackground(this.bg_color, false)
            })
        }
        else {
            this.content_container.removeAttribute("root");
            this.updateBorders()
        }

        if (this.header && this.header instanceof Elements.Header) this.header.update()
    }

    /** inter-element messages */

    // set 'parent' element that receives messages from this element, messages bubble up
    #bound_parent:Base;
    #bound_parent_key:Symbol
    #bound_children:Map<Base, Symbol> = new Map();
   
    // save element as the bound parent / add this as child to a parent
    bindTo(parent:Base){
        let key = Symbol("bind key");
        this.__bindTo(parent, key);
        parent.__bind(this,  key)
    }
    // remove bound to parent 
    unbindFrom(parent:Base){
        this.__unbindFrom(parent, this.#bound_parent_key);
        parent.__unbind(this,  this.#bound_parent_key)
    }

    // save element as a bound child // add child to this
    bind(child:Base){
        let key = Symbol("bind key");
        child.__bindTo(this, key);
        this.__bind(child, key);
    }
    // remove bound child 
    unbind(child:Base){
        child.__unbindFrom(this, this.#bound_children.get(child));
        this.__unbind(child, this.#bound_children.get(child));
    }


    public __bindTo(parent:Base, key:Symbol){
        if (this.#bound_parent) throw Error("Element is already bound to a parent element");
        this.#bound_parent = parent;
        this.#bound_parent_key = key;
    }

    public __unbindFrom(parent:Base, key:Symbol){
        if (this.#bound_parent === parent && this.#bound_parent_key === key) {
            this.#bound_parent_key = null;
            this.#bound_parent = null;
        }
        else throw Error("Not allowed to unbind from this element");
    }
    public __bind(child:Base, key:Symbol){
        this.#bound_children.set(child, key);
    }
    public __unbind(child:Base, key:Symbol){
        if (this.#bound_children.get(child) === key) {
            this.#bound_children.delete(child);
        }
        else throw Error("Not allowed to unbind this element");
    }


    // send a message, bubble up
    sendMessageUp(type:string, data?:any){
        if (this.#bound_parent) {
            this.#bound_parent.newMessage(type, data, this, this.#bound_parent_key, true);
        }
    }

    // send a message, bubble down
    sendMessageDown(type:string, data?:any){
        for (let [child, key] of this.#bound_children.entries()) {
            child.newMessage(type, data, this, key, false);
        }
    }

    // send a message down to a specific child or up to the parent
    sendMessageTo(to:Base, type:string, data?:any) {
        if (to == this.#bound_parent) this.sendMessageUp(type, data);
        else if (this.#bound_children.has(to)) to.newMessage(type, data, this, this.#bound_children.get(to), false);
    }

    // received a message from a child or parent
    public async newMessage(type:string, data:string, from:Base, key:Symbol, up = true) {

        // is valid parent or child?
        if (this.#bound_children.get(from)===key || (this.#bound_parent===from&&this.#bound_parent_key===key)) {
            
            // check redirects first
            let redirect_to:Base;
            if (redirect_to=this.#message_redirects_for_type.get(type)?.get(from)) {
                this.sendMessageTo(redirect_to, type, data);
                return;
            }
            else if (redirect_to=this.#message_redirects.get(from)) {
                this.sendMessageTo(redirect_to, type, data);
                return;
            }
            
            // check for message handlers
            let accepted = false;

            if (this.#message_listeners_for_type.has(type)) accepted = await this.#message_listeners_for_type.get(type)(type,data,from);
            else if (this.#message_listener) accepted = await this.#message_listener(type,data,from);

            // bubble message up or down if not accepted
            if (!accepted) {
                if (up) this.sendMessageUp(type, data); 
                else this.sendMessageDown(type, data)
            } 

        }
    }

    #message_listeners_for_type:Map<string,Function> = new Map();
    #message_listener:Function;
    #message_redirects_for_type:Map<string,Map<Base, Base>> = new Map();
    #message_redirects:Map<Base, Base> = new Map();

    // handler: receive a message that comes from a child element  (SHOULD BE PROTECTED)
    protected onMessage(handler:(type:string, data:any, from:Base)=>Promise<boolean>|boolean|void, type?:string) {
        if (!handler) return;
        if (type) this.#message_listeners_for_type.set(type, handler);
        else this.#message_listener = handler;
    }
    // set message redirect rule between two (child) elements  (SHOULD BE PROTECTED)
    protected redirectMessages(from:Base, to:Base, type?:string) {
        if (!from || !to) return;
        if (type) {
            if (!this.#message_redirects_for_type.has(type)) this.#message_redirects_for_type.set(type, new Map())
            this.#message_redirects_for_type.get(type).set(from, to);
        }
        else this.#message_redirects.set(from, to);
    }

    public hide(){

        if (this.is_hidden) return;
        this.is_hidden = true;
        this.style.display = "none";
        this.handleHide();
    }

    public triggerHideEvent() {
        this.handleHide();
    }

    public show() {
        this.is_hidden = false;
        this.showIfActive();
        this.triggerShowEvent()
    }

    public triggerShowEvent() {
        this.updateScrollPosition()
        this.handleShow();
    }

    set collector(collector:Group) {
        this.options.collector = collector;
    }

    get collector() {
        return this.options.collector;
    }

    #scroll_context:scrollContext = {}
    
    protected makeScrollContainer(element:HTMLElement, scroll_x = true, scroll_y = true) {
        // TODO: save scroll state
        return makeScrollContainer(element, scroll_x, scroll_y, this.#scroll_context);
    }

    /** handle the scroll position updates **/

    public updateScrollPosition(x?:number, y?:number) {
        return updateScrollPosition(this.#scroll_context, x, y);
    }

    public scrollToBottom(force_scroll = false){
        return scrollToBottom(this.#scroll_context, force_scroll);
    }

    public scrollToTop(){
        return scrollToTop(this.#scroll_context);
    }

    override remove() {
        logger.debug("remove element ?", this.id || this.constructor.name);
        if (this == Actions.getActiveDialogElement()) Actions.closeActiveDialog(); // is dialog element, close dialog
        else if (this.parent) this.parent.removeElement(this); // tell parent to remove
        else super.remove();
    }

    // original remove
    public removeNode(){
        this.onRemove?.();
        super.remove()
    }

    /** event fired when the title / icon of this element changes, e.g. for a TabGroup */

    private flag_add_listeners = new Map<string|number, Set<Function>>();
    private flag_remove_listeners = new Map<string|number, Set<Function>>();

    private flag_general_add_listeners = new Set<Function>();
    private flag_general_remove_listeners = new Set<Function>();

    private _flags = new Set<string|number>();

    public onFlagAdded(flag_name_or_listener:string|number|((flag_name:string)=>void), listener?:()=>void) {
        if (typeof flag_name_or_listener !== "function") {
            if (!this.flag_add_listeners.has(flag_name_or_listener)) this.flag_add_listeners.set(flag_name_or_listener, new Set())
            this.flag_add_listeners.get(flag_name_or_listener).add(listener)
            return listener;
        }
        else {
            this.flag_general_add_listeners.add(flag_name_or_listener)
            return flag_name_or_listener;
        }
    }

    public onFlagRemoved(flag_name_or_listener:string|number|((flag_name:string)=>void), listener?:()=>void) {
        if (typeof flag_name_or_listener !== "function") {
            if (!this.flag_remove_listeners.has(flag_name_or_listener)) this.flag_remove_listeners.set(flag_name_or_listener, new Set())
            this.flag_remove_listeners.get(flag_name_or_listener).add(listener)
            return listener;
        }
        else {
            this.flag_general_remove_listeners.add(flag_name_or_listener)
            return flag_name_or_listener;
        }

    }

    public removeFlagListener(listener:Function) {
        this.flag_general_remove_listeners.delete(listener);
        this.flag_general_add_listeners.delete(listener);
        for (let [flag, l] of this.flag_add_listeners) l.delete(listener)
        for (let [flag, l] of this.flag_remove_listeners) l.delete(listener)
    }



    public focusContent (){
        this.content_container?.focus();
    }

    #first_focus_resolve?: Function
    #first_focus = new Promise<void>(resolve=>this.#first_focus_resolve=resolve)

    // focus & blur
    override focus(){
        this.in_focus = true;
        this.classList.add("focus");
        this.#first_focus_resolve?.();
        if (this.parent) this.parent.handleChildElementFocused(this);
    }

    override blur(){
        this.in_focus = false;
        this.classList.remove("focus")
    }


      
    protected showInitDialog():Promise<object> {
        const options_list = this.requiredOptionsList();

        for (const [key, value] of Object.entries(options_list)) {
            if (this.options[key]) value.default = this.options[key]
        }
        logger.success `${options_list}`;
        let new_options = {};
        let body = document.createElement("div");// TODO UIX.Snippets.Form(options_list, new_options)

        return new Promise((resolve, reject)=>{
            Actions.dialog(I(this.options.icon?.toString()) +" Create new " + this.constructor.name, body, [
                {text:"Cancel", onClick:()=>reject()},
                {text:"Create", color:"#29c73d", dark_text:true, onClick:()=>resolve(new_options)}
            ]);
        });
    }


    #border_top:number;
    #border_bottom:number;
    #border_left:number;
    #border_right:number;

    #current_border_color:string;
    protected get current_border_color() {return this.#current_border_color}

    protected set current_border_color(color:string) {
        // ignore if currently root window
        if (this.is_root_element) return;
        
        this.#current_border_color = color;
        // full border
        let full_border = this.options.border && this.options.border_left==undefined && this.options.border_right==undefined && this.options.border_top==undefined && this.options.border_bottom==undefined;
        
        if (full_border) {
            this.content_container.style.boxShadow = this.current_border_color + " 0 0 0 " + this.#border_top + "px inset";
        }
        else {
            // other borders
            let box_shadows = []
            if (this.#border_top)    box_shadows.push(this.current_border_color + " 0 "+this.#border_top+"px inset");
            if (this.#border_bottom) box_shadows.push(this.current_border_color + " 0 -"+this.#border_bottom+"px inset");
            if (this.#border_left)   box_shadows.push(this.current_border_color + " "+this.#border_left+"px 0 inset");
            if (this.#border_right)  box_shadows.push(this.current_border_color + " -"+this.#border_right+"px 0 inset");
            
            if (box_shadows.length) this.content_container.style.boxShadow = box_shadows.join(",");
        }     
    }


    // set css borders (box-shadow) based on options
    protected updateBorders() {

        // TODO make dynamic updates optional (for more css attributes)

        let border_top = this.options.border_top ?? this.options.border;
        let border_bottom = this.options.border_bottom ?? this.options.border;
        let border_left = this.options.border_left ?? this.options.border;
        let border_right = this.options.border_right ?? this.options.border;

        this.#border_top = border_top = border_top === true ? DEFAULT_BORDER_SIZE : <number>border_top;
        this.#border_bottom = border_bottom = border_bottom === true ? DEFAULT_BORDER_SIZE : <number>border_bottom;
        this.#border_left = border_left = border_left === true ? DEFAULT_BORDER_SIZE : <number>border_left;
        this.#border_right = border_right = border_right === true ? DEFAULT_BORDER_SIZE : <number>border_right;
        this.updatePadding();

        // has border color TODO also update
        if (this.options.border_color) {
            this.current_border_color = HTMLUtils.getCSSProperty(this.options.border_color);
        }
        // calculate color from background (dynamic)
        else if (this.options.bg_color&&HTMLUtils.getCSSProperty(this.options.bg_color, false)!="transparent") {
            this.current_border_color = Theme.mode.val == "dark" ? 
                    Utils.lightenDarkenColor(<`#${string}`>HTMLUtils.getCSSProperty(this.options.bg_color, false), 35) :  
                    Utils.lightenDarkenColor(<`#${string}`>HTMLUtils.getCSSProperty(this.options.bg_color, false), -30);
        }
        else this.current_border_color = 'var(--border)'   
    }

    protected updateBorderRadius() {
        this.setBorderRadius(this.style)
        this.setBorderRadius(this.content_container.style)
    }

    protected setBorderRadius(style:CSSStyleDeclaration) {
        const tl_radius = this.options.border_tl_radius ?? this.options.border_radius ?? 0;
        const tr_radius = this.options.border_tr_radius ?? this.options.border_radius ?? 0;
        const bl_radius = this.options.border_bl_radius ?? this.options.border_radius ?? 0;
        const br_radius = this.options.border_br_radius ?? this.options.border_radius ?? 0;

        style.borderTopLeftRadius = tl_radius+"px";
        style.borderTopRightRadius = tr_radius+"px";
        style.borderBottomLeftRadius = bl_radius+"px";
        style.borderBottomRightRadius = br_radius+"px";
    }


    protected floatingMenu(el:HTMLElement|string) {
        const menu = document.createElement("div");
		HTMLUtils.setCSS(menu, {
            position: 'absolute',
            right: '15px',
            top: '15px',
            color: this.text_color
        })
        menu.append(el);
        this.shadow_root.append(menu)
    }

    protected getStyle(){
        const style = document.createElement('style');
        style.textContent = `
        `
        return style;
    }

    protected default_context_menu:Types.context_menu = {
        element_settings: {
            text: S`element_settings`,
            handler: ()=>{
                let settings = new Components.ComponentSettings({component_name:this.constructor.name});
                settings.setReferencedElement(this);
                Actions.elementDialog(settings);
            }
        },
        show_fullscreen: {
            text: S`show_fullscreen`,
            icon: 'fas-expand',
            // shortcut: 'toggle_fullscreen',
            handler: ()=>{
                Actions.goFullscreen(this, false)
            },
        },
        new_window: {
            text: S`new_window`,
            icon: 'fas-window-maximize',
            handler: ()=>{
                Actions.openElementInNewWindow(this)
            }
        },
        remove_component: {
            text: S`remove_component`,
            handler: ()=>{
                this.remove()
            }
        },
        copy_component: {
            text: S`copy_component`,
            handler: ()=>{Clipboard.putDatexValue(this)}
        }
    }

    protected copy_context_menu:Types.context_menu =  {
        copy: {
            text: S`copy`,
            shortcut: 'copy',
            // @ts-ignore shadow root getSelection not fully supported
            disabled: ()=>!(this.shadow_root.getSelection()?.toString()),
            handler: ()=>{
                // @ts-ignore shadow root getSelection not fully supported
                const text = this.shadow_root.getSelection()?.toString();
                if (text != undefined) navigator.clipboard.writeText(text)
            }
        }
    
    }
    
    protected createContextMenu():Types.context_menu {
        return {}
    }

    protected createMenuBarEntries():false|Types.menu_bar_entries {
        return false
    }

    createDropHandler(){
        if (this.options.enable_drop) {
            Handlers.handleDrop(this, {drop:(v)=>this.onDrop(v)}, this, false);
        }
        else {
            HTMLUtils.addEventListener(this, "drop dragenter dragover dragleave", e=>{e.preventDefault();e.stopPropagation();return false})
        }
    }

    /** replace this element in parent **/
    public override replaceWith<T>(element:Base<T>):any {
        return this.parent?.replaceElement(this, element);
    }

    // @override
    protected onDrop(value:unknown):Promise<void>|void {
        // if (drop_event.types.has(Types.DRAGGABLE.ELEMENT_CREATOR)) {
        //     let data = drop_event.data[Types.DRAGGABLE.ELEMENT_CREATOR];

        //     let placeholder:Base = new UIX.Components.TabGroup();
        //     if (data.type=="multiple") this.replaceWith(placeholder); // TODO better placeholder element?
        //     else placeholder = this;

        //     let drop_el = await (data.get());
        //     if (drop_el) placeholder.replaceWith(drop_el);
        // }

        // else if (drop_event.types.has(Types.DRAGGABLE.ELEMENT)) {
        //     let el = drop_event.data[Types.DRAGGABLE.ELEMENT];
        //     if (el) this.replaceWith(el);
        // }

        // else if (drop_event.types.has(Types.DRAGGABLE.URL)) {
        //     this.replaceWith(new UIX.Components.Webpage({url: drop_event.data[Types.DRAGGABLE.URL]}));
        // }
    }
 


    #has_edit_areas = false;

    protected addEditAreas() {
        // no edit areas if sealed parent / dynamic (flex) size
        if (!this.constraints.resizable || this.constraints.dynamic_size || this.#has_edit_areas || !this.parent || this.parent.options.sealed) return;

        this.#has_edit_areas = true;

        // TODO element position in parent might change! update
        const left_free = this.parent.canResizeLeft(this);
        const right_free = this.parent.canResizeRight(this);
        const top_free = this.parent.canResizeTop(this);
        const bottom_free = this.parent.canResizeBottom(this);

        if (left_free)                  this.enableResize(Types.AREA.LEFT);
        if (top_free)                   this.enableResize(Types.AREA.TOP);
        if (right_free)                 this.enableResize(Types.AREA.RIGHT);
        if (bottom_free)                this.enableResize(Types.AREA.BOTTOM);
        if (left_free)                  this.enableResize(Types.AREA.LEFT);
        if (top_free && left_free)      this.enableResize(Types.AREA.TOP_LEFT);
        if (top_free && right_free)     this.enableResize(Types.AREA.TOP_RIGHT);
        if (bottom_free && left_free)   this.enableResize(Types.AREA.BOTTOM_LEFT);
        if (bottom_free && right_free)  this.enableResize(Types.AREA.BOTTOM_RIGHT);
    }


    private enableResize(type: (typeof Types.AREA)[keyof typeof Types.AREA]){

        // already enabled
        if (this.edit_areas[type]) return;

        // create edit area
        const edit_area = HTMLUtils.createHTMLElement(`<div class="edit-overlay ${type}"></div>`);
        this.edit_areas[type] = edit_area;
        this.shadow_root.append(edit_area);

        const data = {
            mouse_start_x:0,
            mouse_start_y: 0,
            last_mouse_x: 0,
            last_mouse_y: 0,
        }

        let moving = false;

        edit_area.addEventListener("mousedown", (e)=>{
            e.stopPropagation();
            moving = true;
            if (this.parent instanceof Base) this.parent.enableEditProtectors();

            data.last_mouse_x = e.clientX;
            data.last_mouse_y = e.clientY;

            window.addEventListener("mousemove", (e)=>{
                if (!moving) return;
                e.stopPropagation();

                let d_x = e.clientX - data.last_mouse_x;
                let d_y = e.clientY - data.last_mouse_y;
                data.last_mouse_x = e.clientX;
                data.last_mouse_y = e.clientY;
                
                this.parent.handleChildResize(this, d_x, d_y, type);
            });

            const stop = ()=>{
                moving = false;
                if (this.parent instanceof Base) this.parent.disableEditProtectors();
            }

            window.addEventListener("mouseup", stop)
            window.addEventListener("mouseleave", stop)
        });

        
    }



    protected removeEditAreas(element:Base){
        document.getElementsByClassName('edit-overlay')
        element.content_container.querySelectorAll('.edit-overlay').forEach(e=>e.remove())
        element.content_container.querySelectorAll('.edit-helper').forEach(e=>e.remove())
    }


    public addFlag(flag:string|number){
        this._flags.add(flag);
        for (let l of this.flag_general_add_listeners) l(flag);
        for (let l of this.flag_add_listeners?.get(flag)??[]) l();
    }

    public removeFlag(flag){
        this._flags.delete(flag)
        for (let l of this.flag_general_remove_listeners) l(flag);
        for (let l of this.flag_remove_listeners?.get(flag)??[]) l();
    }

    public observeOption(key:keyof O, handler: (value: unknown, key?: unknown, type?: Datex.Value.UPDATE_TYPE) => void) {
        Datex.Value.observeAndInit(this.options.$$[key], handler, this);
    }
    public observeOptions(keys:(keyof O)[], handler: (value: unknown, key?: unknown, type?: Datex.Value.UPDATE_TYPE) => void) {
        for (const key of keys) this.observeOption(key, handler);
    }
    public observeConstraint(key:keyof Types.component_constraints, handler: (value: unknown, key?: unknown,  type?: Datex.Value.UPDATE_TYPE) => void) {
        Datex.Value.observeAndInit(this.constraints.$$[key], handler, this);
    }
    public observeConstraints(keys:(keyof Types.component_constraints)[], handler: (value: unknown, key?: unknown,  type?: Datex.Value.UPDATE_TYPE) => void) {
        for (const key of keys) this.observeConstraint(key, handler);
    }

    // title: always a string value, title_dx: always a DatexValue<string>
    public override get title(){return Datex.Value.collapseValue(this.options.title,true,true)}
    public get title_dx(){return <Datex.Value<string>>this.options_props.title}

    public get short_title(){return this.options.short_title ? Datex.Value.collapseValue(this.options.short_title,true,true) : this.title}
    public get short_title_dx(){return this.options.short_title ? <Datex.CompatValue<string>>this.options_props.short_title : this.title_dx}

    public get formatted_title_dx(){return <Datex.Value<string>>this.options_props.title} // can be overriden for custom title formatting


    public get icon(){return Datex.Value.collapseValue(this.options.icon,true,true)}
    public get icon_dx(){return <Datex.CompatValue<string>>this.options_props.icon}

    public get identifier(){return this.options.identifier ?? this.tagName.replace('UIX-','').replace(/-/g,'_').toLowerCase()}
    public set identifier(identifier:string){
        super.id = identifier;
        this.options.identifier = identifier;
    }

    
    public get unique_identifier(){return this.options.identifier ? this.constructor.name + "::" + this.options.identifier : undefined}

    public get flags(){return this._flags;}

    public override set title(title:string){
        this.options.title = title;
    }

    public set short_title(short_title:string) {
        this.options.short_title = short_title;
    }

    public set icon(icon:string){
        this.options.icon = icon;
    }



    // width + height get dynamic
    public get width(): number {return this.offsetWidth}
    public get height(): number {return this.offsetHeight}
    public get left(): number {return this.offsetLeft}
    public get top(): number {return this.offsetTop}

    // get colors
    public get text_color(): string {return HTMLUtils.getCSSProperty(this.options.text_color) || 'var(--text)'}
    public get text_color_light(): string {return HTMLUtils.getCSSProperty(this.options.text_color_light) || 'var(--text_light)'}
    public get text_color_highlight(): string {return HTMLUtils.getCSSProperty(this.options.text_color_highlight) || 'var(--text_highlight)'}
   

    // paddings
    public set padding(padding: number) {
        // reset all other paddings
        if (this.options.padding_bottom != null) delete this.options.padding_bottom;
        if (this.options.padding_top != null) delete this.options.padding_top;
        if (this.options.padding_left != null) delete this.options.padding_left;
        if (this.options.padding_top != null) delete this.options.padding_top;

        this.options.padding = padding;
        this.updatePadding()
    }
    public set padding_left(padding_left: number) {this.options.padding_left = padding_left;this.updatePadding()}
    public set padding_right(padding_right: number) {this.options.padding_right = padding_right;this.updatePadding()}
    public set padding_top(padding_top: number) {this.options.padding_top = padding_top;this.updatePadding()}
    public set padding_bottom(padding_bottom: number) {this.options.padding_bottom = padding_bottom;this.updatePadding()}

    public get padding() {return this.options.padding||0}
    public get padding_left()   {return ((this.options.padding_left != null)    ? this.options.padding_left    : this.options.padding) || 0}
    public get padding_right()  {return ((this.options.padding_right != null)   ? this.options.padding_right   : this.options.padding) || 0}
    public get padding_top()    {return ((this.options.padding_top != null)     ? this.options.padding_top     : this.options.padding) || 0}
    public get padding_bottom() {return ((this.options.padding_bottom != null)  ? this.options.padding_bottom  : this.options.padding) || 0}

    // margins
    public set margin(margin: number) {this.constraints.margin = margin;this.updateMargin()}
    public set margin_left(margin_left: number) {this.constraints.margin_left = margin_left;this.updateMargin()}
    public set margin_right(margin_right: number) {this.constraints.margin_right = margin_right;this.updateMargin()}
    public set margin_top(margin_top: number) {this.constraints.margin_top = margin_top;this.updateMargin()}
    public set margin_bottom(margin_bottom: number) {this.constraints.margin_bottom = margin_bottom;this.updateMargin()}

    public get margin() {return this.constraints.margin||0}
    public get margin_left()   {return ((this.constraints.margin_left != null)    ? this.constraints.margin_left    : this.constraints.margin) || 0}
    public get margin_right()  {return ((this.constraints.margin_right != null)   ? this.constraints.margin_right   : this.constraints.margin) || 0}
    public get margin_top()    {return ((this.constraints.margin_top != null)     ? this.constraints.margin_top     : this.constraints.margin) || 0}
    public get margin_bottom() {return ((this.constraints.margin_bottom != null)  ? this.constraints.margin_bottom  : this.constraints.margin) || 0}

    // border
    public get border_color() {return HTMLUtils.getCSSProperty(this.options.border_color)}
    public set border_color(color:string) {
        this.options.border_color = color;
        this.updateBorders();
    }

    // dynamic (auto) size
    public get dynamic_size(){return this.constraints.dynamic_size ?? false}
    public set dynamic_size(dynamic_size:boolean){this.constraints.dynamic_size = dynamic_size}

    // method to actually update layout to dynamic or fixed
    public setSizeDynamic(){
        this.style.height = "auto";
        this.style.width = "auto";
        this.style.position = "relative";
    }

    public setSizeFixed(){
        this.style.width = '';
        this.style.height = '';
        this.updateMargin();
        this.updatePadding();
    }

    public get bg_color(){
        return HTMLUtils.getCSSProperty(this.options.bg_color, false);
    }

    // grid positioning
    public get gx() {return this.constraints.gx}
    public get gy() {return this.constraints.gy}
    public get gw() {return this.constraints.gw}
    public get gh() {return this.constraints.gh}

    public set gx(gx:number) {this.constraints.gx = gx}
    public set gy(gy:number) {this.constraints.gy = gy}
    public set gw(gw:number) {this.constraints.gw = gw}
    public set gh(gh:number) {this.constraints.gh = gh}


    // use_100_vh to fill the full height on mobile pages if the element is the root element on the page
    protected updateMargin() {
        // update margins

        let unit = "px";
        const scale = 1;

        // update edit helper positions
        if(this.edit_helpers) {
            if(this.edit_helpers[Types.AREA.LEFT])   this.edit_helpers[Types.AREA.LEFT].css({
                left:this.margin_left+10+unit
            });
            if(this.edit_helpers[Types.AREA.RIGHT])  this.edit_helpers[Types.AREA.RIGHT].css({right:this.margin_right*scale+10+ unit});
            if(this.edit_helpers[Types.AREA.TOP])    this.edit_helpers[Types.AREA.TOP].css({top:this.margin_top*scale+10+ unit});
            if(this.edit_helpers[Types.AREA.BOTTOM]) this.edit_helpers[Types.AREA.BOTTOM].css({bottom:this.margin_bottom*scale+10+ unit});
        }

        // update css with margins
        this.style.paddingLeft = this.margin_left*scale + unit;
        this.style.paddingRight = this.margin_right*scale + unit;
        this.style.paddingTop = this.margin_top*scale + unit;
        this.style.paddingBottom = this.margin_bottom*scale + unit;
     
    }

    protected updatePadding() {
        if (!this.CONTENT_PADDING) return;

        let unit = "px";
        const scale = 1;

        this.content_container.style.paddingLeft = (this.options.fill_border ? 0 : this.#border_left??0) + this.padding_left*scale + unit;
        this.content_container.style.paddingRight = (this.options.fill_border ? 0 : this.#border_right??0) + this.padding_right*scale + unit;
        this.content_container.style.paddingTop = (this.options.fill_border ? 0 : this.#border_top??0) + this.padding_top*scale + unit;
        this.content_container.style.paddingBottom = (this.options.fill_border ? 0 : this.#border_bottom??0) + this.padding_bottom*scale + unit;
    }


    protected static element_in_focus: Base;

    protected menu_bar_entries:Types.menu_bar_entries|false;

    protected async handleFocus() {
        if (Base.element_in_focus == this) return;
        else if (Base.element_in_focus) Base.element_in_focus.handleBlur(); 
        
        Base.element_in_focus = this;

        const handle = await this.onFocus?.(); // return true in onFocus
        if (handle !== false) {
            // generate menu bar entries
            if (this.menu_bar_entries == undefined) {
                const entries = this.createMenuBarEntries()
                if (entries) this.menu_bar_entries = entries;
                else this.menu_bar_entries = false;
            }
            // has menu bar entries
            if (typeof this.menu_bar_entries == "object") Actions.setMenuBarEntries(this.menu_bar_entries);
            else Actions.clearMenuBarEntries();
        }
    }

    protected handleBlur() {
        this.onBlur?.();
    }  

    protected handleShow() {
        this.dispatchEvent(new Event("show"))
        this.onShow?.()
    }

    protected handleHide() {
        this.dispatchEvent(new Event("hide"))
        this.onHide?.()
    }

    // @implement

    // show the element (remove display:none), only if element should be visible (e.g. is active tab element)
    // lets the parent group handle this
    protected showIfActive(){
        // parent is Component
        if (this.parent instanceof Base) this.parent.showChildIfActive(this);
        // no known parent
        else this.style.display = "flex";
    }
    
    // return if required options are all set / valid
    protected hasValidOptions(): boolean {return true}

    // return a list of required options with types etc. for manual initializazion
    protected requiredOptionsList(): Types.form_data {return {}}
    
    protected onBlur?():void // when mouse focus lost
    protected onFocus?():void|boolean // when mouse focused
    protected onShow?():void //  when show() is called
    protected onHide?():void // called when element is created with options.hidden set to true, or when hide() is called
    protected onClick?():void // called when element is clicked (options.clickable must be enabled)

    protected onRoute?(identifier:string, is_initial_route:boolean):Promise<void|Base|boolean>|void|Base|boolean // called when a route is requested from the component, return element matching the route identifier or true if route was handled
    protected routeDelegate?: Base; // delegate that handles all routes for this component
    getInternalRoute():string[] {return []} // called to get the current route of the component (child route)

    // called when element size or position changed
    protected onConstraintsChanged() {}

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

    // called after constructor
    protected onConstruct?():Promise<void>|void
    // called after constructor and after init
    protected onConstructed?():Promise<void>|void

    // called after constructor or replicator (before onConstructed, after onConstruct)
    protected onInit?():Promise<void>|void

    // generate custom element base layout (content_element, style)
    protected onCreateLayout?():void

    // responsive layout changes required
    protected onLayoutModePortrait?():boolean|void // return false if layout was not changed to portrait (override portrait)
    protected onLayoutModeNormal?():boolean|void // return false if layout was not changed to normal
    protected onResize?():void // called when element is resized (only if responsive is enabled)

}

// datex type for constraints (with prototype)
Datex.Type.get("uix:constraints").setJSInterface({
    prototype: Base.DEFAULT_CONSTRAINTS,
    proxify_children: true,
    is_normal_object: true,
})