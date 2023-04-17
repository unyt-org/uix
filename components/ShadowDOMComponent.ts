// deno-lint-ignore-file no-async-promise-executor
import { PlaceholderCSSStyleDeclaration, addStyleSheetLink } from "../utils/css_style_compat.ts";
import { Theme } from "../base/theme.ts";
import { BaseComponent, standaloneContentPropertyData, standaloneProperties } from "./BaseComponent.ts"
import { App } from "../app/app.ts";
import { logger } from "../utils/global_values.ts"

// deno-lint-ignore no-namespace
export namespace ShadowDOMComponent {
    export interface Options extends BaseComponent.Options {

    }
}

@Component
export class ShadowDOMComponent<O extends ShadowDOMComponent.Options = ShadowDOMComponent.Options, ChildElement extends HTMLElement = HTMLElement> extends BaseComponent<O, ChildElement> {
    
    /************************************ STATIC ***************************************/
    
    protected static override stylesheets:string[] =  [
        // global base style
        new URL('../style/elements.css', import.meta.url).toString(),
        new URL('../style/base.css', import.meta.url).toString(),
        new URL('../style/fontawesome.css', import.meta.url).toString()
    ]
    
    protected static override getSelectorCode(propData:standaloneContentPropertyData) {
        // direct child
        if (propData.type == "child") 
            return `this.querySelector("#${propData.id}")`;
        // shadow root child
        else 
            return `this.shadowRoot.querySelector("#${propData.id}")`;
    }

    /************************************ END STATIC ***************************************/


    // shadow DOM slot - all children go here
    content!:HTMLElement;

    override get shadowRoot() {
        return super.shadowRoot ?? this.attachShadow({mode: 'open'})
    }

    protected override init(constructed?: boolean) {

        this.addStyleSheet(Theme.stylesheet);

        // init Shadow DOM
        this.content = document.createElement('slot');
        this.content.classList.add("content");
        this.content.id = "content";
        this.shadowRoot.append(this.content);

        return super.init(constructed)
    }

    public appendContent(...elements:(HTMLElement|string)[]) {
        this.content.append(...elements)
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
            html += `<link rel=stylesheet href="${url}">`;
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


    // adopted constructed stylesheet for shadow root
    #adopted_root_style?:CSSStyleDeclaration 

    /**
     * Add a style to the shadow root adoptedStyleSheets
     * @param style style text or CSSStyleSheet
     */
    protected override adoptStyle(style:string|CSSStyleSheet, __pass_through = false) {
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
    
    protected override insertStyleSheetLink(url:URL) {
        addStyleSheetLink(this.shadowRoot, url);
    }

    /**
     * add a default adopted CSSStyleSheet which is referenced by this.shadowStyle
     */
    protected addBaseStyle(){
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

}