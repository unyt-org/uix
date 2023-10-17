import { Datex } from "datex-core-legacy"
import { defaultElementAttributes, elementEventHandlerAttributes, htmlElementAttributes, mathMLTags, svgElementAttributes, svgTags } from "../attributes.ts";
import type { Element, Text, DocumentFragment, HTMLTemplateElement, HTMLElement, SVGElement, MathMLElement, Node, Comment, Document, HTMLInputElement } from "../dom/mod.ts";

import { IterableHandler } from "datex-core-legacy/utils/iterable-handler.ts";
import { DX_VALUE } from "datex-core-legacy/datex_all.ts";
import { DOMContext } from "../dom/DOMContext.ts";
import { JSTransferableFunction } from "datex-core-legacy/types/js-function.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";

export const JSX_INSERT_STRING: unique symbol = Symbol("JSX_INSERT_STRING");

type appendableContentBase = Datex.RefOrValue<Element|DocumentFragment|string|number|bigint|boolean>|Promise<appendableContent>;
type appendableContent = appendableContentBase|Promise<appendableContentBase>


// deno-lint-ignore no-namespace
export namespace DOMUtils {
    export type elWithEventListeners = HTMLElement & {[DOMUtils.EVENT_LISTENERS]:Map<keyof HTMLElementEventMap, Set<(...args:any)=>any>>}

}

export class DOMUtils {

    static readonly EVENT_LISTENERS: unique symbol = Symbol.for("DOMUtils.EVENT_LISTENERS");

    readonly svgNS = "http://www.w3.org/2000/svg"
	readonly mathMLNS = "http://www.w3.org/1998/Math/MathML"
	
	constructor(public readonly context: DOMContext) {}
    get document() {return this.context.document}


	escapeHtml(str:string) {
        if (typeof str != "string") return "";
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replaceAll('"', '&quot;').replaceAll("'", '&#039;').replace('\u0009', '&#9;')
    }


    createHTMLElement(html?:string, content?:Datex.RefOrValue<HTMLElement>|(Datex.RefOrValue<HTMLElement>)[]):HTMLElement {
        if (html == undefined) html = "<div></div>";
        const template = this.document.createElement('template');
        html = html.trim();
        template.innerHTML = html;
        const element = <HTMLElement>template.content.firstChild;
        if (content != undefined) {
            // set html
            if (Datex.Ref.collapseValue(content,true,true) instanceof this.context.HTMLElement) this.setElementHTML(element, <HTMLElement>content);
            // set child nodes
            if (content instanceof Array) {
                for (const el of content){
                    if (Datex.Ref.collapseValue(el,true,true) instanceof this.context.HTMLElement) element.append(Datex.Ref.collapseValue(el,true,true))
                    else {
                        const container = this.document.createElement("div");
                        this.setElementText(container, el);
                        element.append(container);
                    }
                }
            }
            // set text
            else this.setElementText(element, content);
        }
        return element;
    }

    // remember which values are currently synced with element content - for unobserve
    private element_bound_html_values = new WeakMap<Element, Datex.Value>();
    private element_bound_text_values = new WeakMap<Element, Datex.Value>();

    private updateElementHTML = function (this:Element, html:Element|string){
        if (html instanceof Element) {
            this.innerHTML = '';
            this.append(html)
        } 
        else this.innerHTML = html ?? '';
    }

    private updateElementText = function (this:HTMLElement, text:unknown){
        if (this instanceof Datex.Ref) console.warn("update text invalid", this, text)
        
        if (text instanceof Datex.Markdown) {
            this.innerHTML = (text.getHTML() as HTMLElement).children[0].innerHTML;
        }
        // @ts-ignore _use_markdown
        else if (this._use_markdown && typeof text == "string") {
            this.innerHTML = (new Datex.Markdown(text).getHTML() as HTMLElement).children[0].innerHTML;
        }
        else this.innerText = ((<any>text)?.toString()) ?? ''
    }

    setElementHTML<T extends Element>(element:T, html:Datex.RefOrValue<string|Element>):T {
        // unobserve?
        this.element_bound_html_values.get(element)?.unobserve(element);
        this.element_bound_text_values.get(element)?.unobserve(element);

        // none
        if (html == undefined) element.innerHTML = '';

        // DatexValue
        if (html instanceof Datex.Ref) {
            this.updateElementHTML.call(element, html.val);

            // @ts-ignore: TODO: fix?
            html.observe(this.updateElementHTML, element);
            this.element_bound_html_values.set(element, html);
        }
        // default
        else this.updateElementHTML.call(element, html);

        return element;
    }

    setElementText<T extends HTMLElement>(element:T, text:Datex.RefOrValue<unknown>, markdown = false):T{
        // unobserve?
        this.element_bound_html_values.get(element)?.unobserve(element);
        this.element_bound_text_values.get(element)?.unobserve(element);
        
        // @ts-ignore markdown flag
        element._use_markdown = markdown;

        // none
        if (text == undefined) element.innerText = '';

        // DatexValue
        else if (text instanceof Datex.Value) {
            this.updateElementText.call(element, text.val);

            text.observe(this.updateElementText, element);
            this.element_bound_text_values.set(element, text);
        }
        // default
        else this.updateElementText.call(element, text);

        return element;
    }


	createElement(tagName:string): SVGElement|MathMLElement|HTMLElement {
		if (svgTags.has(tagName as any)) return this.document.createElementNS(this.svgNS, tagName as any) as SVGElement;
		else if (mathMLTags.has(tagName as any)) return this.document.createElementNS(this.mathMLNS, tagName as any) as MathMLElement;
		else return this.document.createElement(tagName as any) as HTMLElement;
	}


    /**
     * Append children to a parent, updates children dynamically if pointer of iterable provided
     * @param parent 
     * @param children 
     * @returns 
     */
    append<T extends Element|DocumentFragment>(parent:T, children:appendableContent|appendableContent[]):T | undefined {
        // @ts-ignore extract children ref iterable from DocumentFragment
        if (children instanceof this.context.DocumentFragment && children._uix_children) children = children._uix_children

        // is ref and iterable/element
        if (!(parent instanceof this.context.DocumentFragment) && Datex.Pointer.isReference(children) && (children instanceof Array || children instanceof Map || children instanceof Set)) {
            // is iterable ref
            // TODO: support promises
            const startAnchor = new this.context.Comment("start " + Datex.Pointer.getByValue(children)?.idString())
            const endAnchor = new this.context.Comment("end " + Datex.Pointer.getByValue(children)?.idString())
            parent.append(startAnchor, endAnchor)

            const iterableHandler = new IterableHandler(children, {
                map: (v,k) => {
                    const el = this.valuesToDOMElement(v);
                    return el;
                },
                onEntryRemoved: (v,k) => {
                    if (parent.contains(v)) parent.removeChild(v);
                },
                onNewEntry: function(v,k) {
                    let previous:Node = startAnchor;

                    for (let prevIndex = k - 1; prevIndex >= 0; prevIndex--) {
                        try {
                            if (this.entries.has(prevIndex)) {
                                previous = this.entries.get(prevIndex)!;
                                break;
                            }
                        }
                        catch (e) {
                            console.log("TODO fix", e)
                        }
                        
                    }
                    parent.insertBefore(v, previous.nextSibling)
                },
                onEmpty: () => {
                    let current:Node|null|undefined = startAnchor.nextSibling;
                    while (current && current !== endAnchor) {
                        const removing = current;
                        current = current?.nextSibling
                        parent.removeChild(removing);
                    }
                }
            })
        

            // TODO: element references updating required?
            // else if (children instanceof Element) {
            //     const scheduler = new TaskScheduler(true);
            //     let lastChildren: Node[] = [];
    
            //     Datex.Ref.observeAndInit(children, () => {
            //         scheduler.schedule(
            //                 Task(resolve => {
            //                     appendNew(parent, Array.isArray(children) ? children : [children], lastChildren, (e) => {
            //                         lastChildren = e;
            //                         resolve();
            //                     });
            //                 })
            //             ); 
            //         },
            //         undefined,
            //         null, 
            //         {
            //             recursive: false,
            //             types: [Datex.Ref.UPDATE_TYPE.INIT]
            //         }
            //     )
            // }
        }

        // is iterable (no ref, collapse recursive)
        // else if (children instanceof Array) {
        //     for (const child of children) {
        //         this.append(parent, child);
        //     }
        // }

        // is not a ref iterable
        else return this._append(parent, Array.isArray(children) ? children : [children]);
    }


    _append<T extends Element|DocumentFragment>(parent:T, children:appendableContent[], oldChildren?: Node[], onAppend?: ((list: Node[]) => void)):T {
        // use content if parent is <template>
        const element = parent instanceof this.context.HTMLTemplateElement ? parent.content : parent;

        let lastAnchor: Node | undefined = oldChildren?.at(-1);

        const lastChildren: Node[] = [];
        const loadingPromised: Promise<void>[] = [];
        for (let child of children) {
            child = (child as any)?.[JSX_INSERT_STRING] ? (child as any).val : child; // collapse safely injected strings

            // wait for promise
            if (child instanceof Promise) {
                const placeholder = this.document.createElement("div")
                placeholder.setAttribute("data-async-placeholder", "");
                if (!lastAnchor)
                    element.append(placeholder);
                else {
                    element.insertBefore(placeholder, lastAnchor.nextSibling);
                    lastAnchor = placeholder;
                }
                loadingPromised.push(child);
                child.then(v=>{
                    const dom = this.valuesToDOMElement(v);
                    // set shadow root or replace
                    if (!this.appendElementOrShadowRoot(element, dom, false, false, e => (lastChildren.push(...e)))) placeholder.replaceWith(dom)
                })
                // return parent;
            } else {
                const dom = this.valuesToDOMElement(child);

                // set shadow root or append
                if (lastAnchor) {
                    this.appendElementOrShadowRoot(lastAnchor, dom, undefined, true, (e) => (lastChildren.push(...e)));
                    lastAnchor = dom;
                }
                else 
                this.appendElementOrShadowRoot(element, dom, undefined, false, (e) => (lastChildren.push(...e)));
            }
        }

        // remove old children 
        for (const child of oldChildren ?? [])
            parent.removeChild(child);

        Promise.all(loadingPromised).then(()=>{
            onAppend?.(lastChildren);
        });
        return parent;
    }



	setElementAttribute<T extends Element>(element:T, attr:string, value:Datex.RefOrValue<unknown>|((...args:unknown[])=>unknown)|{[JSX_INSERT_STRING]:true, val:string}, rootPath?:string|URL):boolean|Promise<boolean> {
        
        // valid attribute name?
        // not an HTML attribute
        if (!(
            attr.startsWith("data-") ||
            attr.startsWith("aria-") ||
            defaultElementAttributes.includes(<typeof defaultElementAttributes[number]>attr) || 
            elementEventHandlerAttributes.includes(<typeof elementEventHandlerAttributes[number]>attr) ||
            (<readonly string[]>htmlElementAttributes[<keyof typeof htmlElementAttributes>element.tagName.toLowerCase()])?.includes(<typeof htmlElementAttributes[keyof typeof htmlElementAttributes][number]>attr) ||
            (<readonly string[]>svgElementAttributes[<keyof typeof svgElementAttributes>element.tagName.toLowerCase()])?.includes(<typeof svgElementAttributes[keyof typeof svgElementAttributes][number]>attr) )) {
                return false;
        }

        
        value = value?.[JSX_INSERT_STRING] ? value.val : value; // collapse safely injected strings

        // first await, if value is promise
        if (value instanceof Promise) return value.then(v=>this.setElementAttribute(element, attr, v, rootPath))

        if (!element) return false;
        // DatexValue
        value = Datex.Pointer.pointerifyValue(value)
        if (value instanceof Datex.Ref) {

            const isInputElement = element.tagName.toLowerCase() === "input";
            const type = Datex.Type.ofValue(value);

            // :out attributes
            if (isInputElement && (attr == "value:out" || attr == "value")) {

                if (type.matchesType(Datex.Type.std.text)) element.addEventListener('input', () => value.val = element.value)
                else if (type.matchesType(Datex.Type.std.decimal)) element.addEventListener('input', () => value.val = Number(element.value))
                else if (type.matchesType(Datex.Type.std.integer)) element.addEventListener('input', () => value.val = BigInt(element.value))
                else if (type.matchesType(Datex.Type.std.boolean)) element.addEventListener('input', () => value.val = Boolean(element.value))
                else throw new Error("The type "+type+" is not supported for the '"+attr+"' attribute of the <input> element");

                // TODO: allow duplex updates for "value"
                if (attr == "value") {
                    const valid = this.setAttribute(element, attr, value.val, rootPath)
                    if (valid) value.observe(v => this.setAttribute(element, attr, v, rootPath));
                    return valid;
                }

                return true;
            }

            // checked attribute
            if (isInputElement && element.getAttribute("type") === "checkbox" && attr == "checked") {
                if (!(element instanceof this.context.HTMLInputElement)) throw new Error("the 'checked' attribute is only supported for <input> elements");

                if (type.matchesType(Datex.Type.std.boolean)) element.addEventListener('change', () => value.val = element.checked)
                else throw new Error("The type "+type+" is not supported for the 'checked' attribute of the <input> element");
            }

            // default attributes

            const valid = this.setAttribute(element, attr, value.val, rootPath)
            if (valid) value.observe(v => this.setAttribute(element, attr, v, rootPath));
            return valid;
        }
        // default
        else return this.setAttribute(element, attr, value, rootPath)
    }

	private setAttribute(element: Element, attr:string, val:unknown, root_path?:string|URL): boolean {

        // special suffixes:

        // non-module-relative paths if :route suffix
        if (attr.endsWith(":route")) {
            attr = attr.replace(":route", "");
            root_path = undefined;
        }

        // display context event handler function
        if (attr.endsWith(":display")) {
            if (typeof val !== "function") throw new Error(`Invalid value for attribute "${attr}" - must be a function`)
            if (client_type == "browser" || val instanceof JSTransferableFunction) {
                // don't change, already a JSTransferableFunction or in display context
            }
            else if (JSTransferableFunction.functionIsAsync(val as (...args: unknown[]) => unknown)) {
                // async! (always returns true, doesn't await promise)
                JSTransferableFunction.createAsync(val as (...args: unknown[]) => Promise<unknown>).then(fn => this.setAttribute(element, attr, fn, root_path)); 
                return true;
            }
            else {
                val = JSTransferableFunction.create(val as (...args: unknown[]) => unknown)
            }
            attr = attr.replace(":display", "");

        }

        // invalid :out attributes here
        if (attr.endsWith(":out")) throw new Error("Invalid value for "+attr+" attribute - must be a pointer");

        // special attribute values
        else if (val === false) element.removeAttribute(attr);
        else if (val === true || val === undefined) element.setAttribute(attr,"");

        // video src => srcObject
        else if (element instanceof this.context.HTMLVideoElement && attr === "src" && globalThis.MediaStream && val instanceof MediaStream) {
            element.srcObject = val;
        }

        // event listener
        else if (attr.startsWith("on")) {
            for (const handler of ((val instanceof Array || val instanceof Set) ? val : [val])) {
                if (typeof handler == "function") {
                    const eventName = <keyof HTMLElementEventMap & string>attr.replace("on","").toLowerCase();
                    element.addEventListener(eventName, handler as any);
                    // save in [DOMUtils.EVENT_LISTENERS]
                    if (!(<DOMUtils.elWithEventListeners>element)[DOMUtils.EVENT_LISTENERS]) (<DOMUtils.elWithEventListeners>element)[DOMUtils.EVENT_LISTENERS] = new Map<keyof HTMLElementEventMap, Set<Function>>().setAutoDefault(Set);
                    // clear previous event listeners for this event (todo: allow multiple)
                    for (const listener of (<DOMUtils.elWithEventListeners>element)[DOMUtils.EVENT_LISTENERS].get(eventName) ?? []) {
                        element.removeEventListener(eventName, listener as any);
                    }
                    (<DOMUtils.elWithEventListeners>element)[DOMUtils.EVENT_LISTENERS].getAuto(eventName).add(handler);
                }
                else throw new Error("Cannot set event listener for element attribute '"+attr+"'")
            }
            
        }
        // special form 'action' callback
        else if (element instanceof this.context.HTMLFormElement && attr === "action") {
            for (const handler of ((val instanceof Array || val instanceof Set) ? val : [val])) {
                // action callback function
                if (typeof handler == "function") {
                    const eventName = "submit";
                    element.addEventListener(eventName, <any>handler);
                    // save in [DOMUtils.EVENT_LISTENERS]
                    if (!(<DOMUtils.elWithEventListeners>element)[DOMUtils.EVENT_LISTENERS]) (<DOMUtils.elWithEventListeners>element)[DOMUtils.EVENT_LISTENERS] = new Map<keyof HTMLElementEventMap, Set<Function>>().setAutoDefault(Set);
                    (<DOMUtils.elWithEventListeners>element)[DOMUtils.EVENT_LISTENERS].getAuto(eventName).add(handler);
                }
                // default "action" (path)
                else element.setAttribute(attr, this.formatAttributeValue(val,root_path));
            }
            
        }

        // value attribute
        else if (attr == "value") {
            (element as HTMLInputElement).value = this.formatAttributeValue(val,root_path)
        }
        // checked attribute
        else if (attr == "checked") {
            (element as HTMLInputElement).checked = this.formatAttributeValue(val,root_path)
        }
        
        // normal attribute
        else element.setAttribute(attr, this.formatAttributeValue(val,root_path));

        return true;
        
    }

    formatAttributeValue(val:any, root_path?:string|URL): string {
        if (root_path==undefined) return val?.toString?.()  ?? ""
        else if (typeof val == "string" && (val.startsWith("./") || val.startsWith("../"))) return new URL(val, root_path).toString();
        else return val?.toString?.() ?? ""
    }


    setCSS<T extends HTMLElement>(element:T, property:string, value?:Datex.CompatValue<string|number>):T
    setCSS<T extends HTMLElement>(element:T, properties:{[property:string]:Datex.CompatValue<string|number>}):T
    setCSS<T extends HTMLElement>(element:T, style:Datex.CompatValue<string>):T
    setCSS<T extends HTMLElement>(element:T, properties_object_or_property:{[property:string]:Datex.CompatValue<string|number>}|Datex.CompatValue<string>, value?:Datex.CompatValue<string|number>):T {
        let properties:{[property:string]:Datex.RefOrValue<string|number|undefined>};
        if (typeof properties_object_or_property == "string" && value != undefined) properties = {[properties_object_or_property]:value};
        else if (typeof properties_object_or_property == "string" || (properties_object_or_property instanceof Datex.Value && Datex.Type.ofValue(properties_object_or_property) == Datex.Type.std.text)) {
            this.setElementAttribute(element, "style", properties_object_or_property)
            return element;
        }
        else properties = Datex.Ref.collapseValue(properties_object_or_property,true,true) as {[property:string]:Datex.CompatValue<string|number|undefined>};

        for (const [property, value] of Object.entries(properties)) {
            this.setCSSProperty(element, property, value);
        }
        return element;
    }

    // set css property, updated if DatexValue
    setCSSProperty<T extends HTMLElement>(element:T, property:string, value:Datex.CompatValue<string|number|undefined>):T{

        // convert camelCase to kebab-case
        property = property?.replace(/[A-Z]/g, x => `-${x.toLowerCase()}`);

        // none
        if (value == undefined) {
            if (element.style.removeProperty) element.style.removeProperty(property);
            // @ts-ignore style property access
            else delete element.style[property];
        }

        // UIX color
        else if (value instanceof Datex.PointerProperty && value.pointer.val == Theme.colors) {
            if (element.style.setProperty) element.style.setProperty(property, `var(--${value.key})`); // autmatically updated css variable
            // @ts-ignore style property access
            else element.style[property] = `var(--${value.key})`
        }
        // other Datex CompatValue
        else {
            Datex.Ref.observeAndInit(value, (v,k,t) => {
                if (v == undefined) {
                    if (element.style.removeProperty) element.style.removeProperty(property);
                    // @ts-ignore style property access
                    else delete element.style[property];
                }
                else {
                    if (element.style.setProperty) element.style.setProperty(property, this.getCSSProperty(<string>v))
                    // @ts-ignore style property access
                    else element.style[property] = this.getCSSProperty(v);
                }
            }, undefined, undefined);
        }
        return element;
    }

    readonly color_names = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
        "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
        "cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
        "darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
        "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
        "darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
        "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
        "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
        "honeydew":"#f0fff0","hotpink":"#ff69b4",
        "indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
        "lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
        "lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
        "lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
        "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
        "mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
        "navajowhite":"#ffdead","navy":"#000080",
        "oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
        "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
        "rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
        "saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
        "tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
        "violet":"#ee82ee",
        "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
        "yellow":"#ffff00","yellowgreen":"#9acd32"
    };

    // convert DatexCompatValue to css property
    getCSSProperty(value:Datex.RefOrValue<number|string>, use_css_variables = true):string {
        // UIX color value
        if (use_css_variables && value instanceof Datex.PointerProperty && value.pointer.val == Theme.colors) {
            value = `var(--${value.key})`; // autmatically updated css variable
        }

        // number value to px
        if (typeof value == "number") return value.toString() + "px";

        else if (use_css_variables) return value?.toString() ?? '';
        // try to collapse value
        else if (value!=undefined) {
            // css variable
            if (value.toString().startsWith('var(--')) return this.context.getComputedStyle(this.document.documentElement).getPropertyValue(value?.toString().replace('var(','').replace(')','')).trim();
            // css color name
            else if (!value.toString().startsWith("#")) return color_names[<keyof typeof color_names>value.toString().toLowerCase()] ?? ''
            // normal string value
            else return value.toString()
        }
        else return '';
    }


    valuesToDOMElement(...values:any[]) {
        if (values.length == 1) {
            if (values[0] instanceof this.context.Element || values[0] instanceof this.context.DocumentFragment) return values[0];
            else return this.getTextNode(values[0]);
        }
        else {
            const fragment = new this.context.DocumentFragment();
            values.forEach(c=>this.append(fragment, c))
            return fragment;
        }
    }

    getTextNode(content:any) {
        const textNode = this.document.createTextNode("");
        textNode[DX_VALUE] = content;

        Datex.Ref.observeAndInit(content, (v,k,t) => {
            textNode.textContent = v!=undefined ? (<any>v).toString() : ''
        }, undefined, undefined);

        return textNode;
    }

    /**
     * 
     * @param anchor 
     * @param element 
     * @param appendAll if false, only shadowRoot is set, other elements are ignored
     * @returns true if element appended
     */
    appendElementOrShadowRoot(anchor: Element|DocumentFragment, element: Element|DocumentFragment|Text, appendAll = true, insertAfterAnchor = false, onAppend?: ((list: (Node)[]) => void)) {
        const appendedContent: Node[] = [];
        for (const candidate of (element instanceof this.context.DocumentFragment ? [...(element.childNodes as any)] : [element]) as unknown as Node[]) {
            if (anchor instanceof this.context.HTMLElement && candidate instanceof this.context.HTMLTemplateElement && candidate.hasAttribute("shadowrootmode")) {
                if (anchor.shadowRoot) throw new Error("element <"+anchor.tagName.toLowerCase()+"> already has a shadow root")
                const shadowRoot = anchor.attachShadow({mode: (candidate.getAttribute("shadowrootmode")??"open") as "open"|"closed"});
                shadowRoot.append((candidate as HTMLTemplateElement).content);
                appendedContent.push(shadowRoot);
                if (!appendAll) {
                    onAppend?.(appendedContent);
                    return true;
                }
            }
            else if (appendAll) {
                if (insertAfterAnchor)
                    anchor.parentElement?.insertBefore(candidate, anchor.nextSibling); // anchor is sibbling (e.g. old elem)
                else anchor.append(candidate); // anchor is parent
                appendedContent.push(candidate)
            }
        }
        onAppend?.(appendedContent);
        return appendAll;
    }

    // jquery-like event listener (multiple events at once)
    addEventListener<E extends HTMLElement>(target:E, events:string, listener: (this: HTMLElement, ev: Event) => any, options?: boolean | AddEventListenerOptions){
        for (const event of events.split(" ")){
            target.addEventListener(event.trim(), listener, options);
        }
    }

    removeEventListener<E extends HTMLElement>(target:E, events:string, listener: (this: HTMLElement, ev: Event) => any, options?: boolean | AddEventListenerOptions){
        for (const event of events.split(" ")){
            target.removeEventListener(event.trim(), listener, options);
        }
    }

    // jquery-like event listener (multiple events at once + delegate with query selector)
    addDelegatedEventListener<E extends Element>(target:E, events:string, selector:string,  listener: (this: Element, ev: Event) => any, options?: boolean | AddEventListenerOptions){
        for (const event of events.split(" ")){
            target.addEventListener(event.trim(), (event) => {
                if (event.target && event.target instanceof this.context.Element && event.target.closest(selector)) {
                    listener.call(event.target, event)
                }
            }, options);
        }
    }

    addProxy(element:Element) {
        return $$(element)
    }
}
