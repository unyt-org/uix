import { IS_HEADLESS } from "./constants.ts";

// fake CSSStyleDeclaration element with proxy to update css property names
export class PlaceholderCSSStyleDeclaration extends Array /*implements CSSStyleDeclaration*/ {
    
    public static toCamelCase(property:string) {
        // ignore variables
        if (property.startsWith("--")) return property;
        return property.replace(/-./g, x=>x[1].toUpperCase());
    }
    public static toKebabCase(property:string) {
        // ignore variables
        if (property.startsWith("--")) return property;
        return property.replace(/[A-Z]/g, x => `-${x.toLowerCase()}`);
    }

    getPropertyPriority(property: string): string {
        throw new Error("PlaceholderCSSStyleDeclaration Method not implemented.");
    }
    getPropertyValue(property: string): string {
        return this[PlaceholderCSSStyleDeclaration.toCamelCase(property)]
    }
    removeProperty(property: string): string {
        const name = PlaceholderCSSStyleDeclaration.toCamelCase(property);
        const val = this[name];
        delete this[name];

        let index = this.indexOf(property);
        if (index != -1) this.splice(index, 1);

        return val;
    }
    setProperty(property: string, value: string | null) {
        if (!this.includes(property)) this.push(property);
        
        this[PlaceholderCSSStyleDeclaration.toCamelCase(property)] = value;
    }

    item(index:number) {
        if (typeof index != "number") return undefined;
        return this[index];
    }

    get cssText() {
        const css = [];
        for (let i = 0; i < this.length; i++) {
            const key = this.item(i);
            css.push(`${key}: ${this[PlaceholderCSSStyleDeclaration.toCamelCase(key)]};`);
        }
        return css.join(" ");
    }

    private constructor(){
        super();
    }


    static create():CSSStyleDeclaration{
        const dec = new PlaceholderCSSStyleDeclaration();
        return <CSSStyleDeclaration><any> new Proxy(dec, {
            set(target, p, newValue, receiver) {

                // number indices or 'length' property
                if (p == "length" || !Number.isNaN(Number(p))) target[p] = newValue; 

                // css properties
                else {
                    (<any>target)[PlaceholderCSSStyleDeclaration.toCamelCase(p)] = newValue;
                    const kebabProp = PlaceholderCSSStyleDeclaration.toKebabCase(<string>p);
                    if (!target.includes(kebabProp)) target.push(kebabProp);
                }

                return true;
            },
            get(target, p, receiver) {
                // number indices or 'length' property
                if (p == "length" || !Number.isNaN(Number(p))) return target[p]; 
                else {
                    return target[PlaceholderCSSStyleDeclaration.toCamelCase(<string>p)];
                }
            },
        })
    }
}


// let constructed_style_sheets_supported = false;
// try {
//     new CSSStyleSheet();
//     constructed_style_sheets_supported = true;
// } catch {
//     logger.warn("using fallback option for css stylesheet generation")
// }




// // only until CSSStyleSheet constructors are supported in SaFaRi...
// // new CSSStyleSheet(); stylesheet.replace(...)
// export function CSSStyleSheetCompat(element:HTMLElement|ShadowRoot|Document, styles?:string, styleSheets?:CSSStyleSheet[]):CSSStyleSheet {
//     // use CSSStyleSheet constructor
//     if (constructed_style_sheets_supported) {
//         const styleSheet = new CSSStyleSheet();
//         // @ts-ignore
//         styleSheet.replaceSync(styles);
//         // update adoptedStyleSheets for element
//         if (styleSheets) {
//             styleSheets.push(styleSheet);
//             adoptStyleSheets(element, ...styleSheets)
//         };
//         return styleSheet;
//     }
//     // fallback only until CSSStyleSheet constructors are supported in SaFaRi...
//     else {
//         // document must be document.body
//         if (element == document) element = document.head;
//         const styleElement = document.createElement('style');
//         styleElement.setAttribute('type', 'text/css');
//         if (styles) styleElement.textContent = styles;
//         element.appendChild(styleElement);
//         return styleElement.sheet;
//     }
   
// }
// // replacement for element.adoptedStyleSheets = [...]
// export function adoptStyleSheets(element:HTMLElement|ShadowRoot|Document, ...styleSheets:CSSStyleSheet[]) {
//     if (constructed_style_sheets_supported) {
//         // @ts-ignore
//         element.adoptedStyleSheets = styleSheets;
//     }
//     else {
//         // document must be document.body
//         if (element == document) element = document.head;
//         // append all new stylesheets (fallback option)
//         for (let sheet of styleSheets) {
//             element.appendChild(sheet.ownerNode.cloneNode(true));
//         }   
//     }
// }

// only until CSSStyleSheet constructors are supported in SaFaRi...
// new CSSStyleSheet(); stylesheet.replace(...)


export function addStyleSheetLink(element:HTMLElement|ShadowRoot, url:string|URL) {
    return new Promise<HTMLLinkElement>((resolve, reject)=>{
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.onload = ()=>{
            resolve(link)
        };
        link.onerror = ()=>{
            link.remove();
            reject("Failed to load stylesheet " + url);
        };
        link.href = url.toString();
        element.appendChild(link);

        // onload not working with JSDom
        if (IS_HEADLESS) {
            (async ()=>{
                try {
                    if ((await fetch(url)).ok) {
                        element.appendChild(link);
                        resolve(link);
                    }
                    else reject("Failed to load stylesheet " + url);
                }
                catch {reject("Failed to load stylesheet " + url);}
            })()   
        }
    })
}

const globalStyleSheets = new Set<string>();

export async function addGlobalStyleSheetLink(url:URL) {
    if (document.head.querySelector('link[href="'+url+'"]') || globalStyleSheets.has(url.toString())) return;
    const link = await addStyleSheetLink(document.head, url);
    link.classList.add("global-style");
    globalStyleSheets.add(url.toString())
}

export function getGlobalStyleSheetLinks() {
	// global stylesheets
    const urls = new Set<string>([...globalStyleSheets]);
	document.head.querySelectorAll(".global-style").forEach(el=>{
        if (el instanceof HTMLLinkElement) urls.add(el.href)
    })
    return urls;
}