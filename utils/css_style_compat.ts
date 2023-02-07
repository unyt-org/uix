import { document } from "./constants.ts";

// fake CSSStyleDeclaration element with proxy to update css property names
export class PlaceholderCSSStyleDeclaration extends Array /*implements CSSStyleDeclaration*/ {
    
    public static toCamelCase(property:string) {
        return property.replace(/-./g, x=>x[1].toUpperCase());
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

    private constructor(){
        super();
    }

    public static toKebabCase(property:string) {
        return property.replace(/[A-Z]/g, x => `-${x.toLowerCase()}`);
    }


    static create():CSSStyleDeclaration{
        const dec = new PlaceholderCSSStyleDeclaration();
        return <CSSStyleDeclaration><any> new Proxy(dec, {
            set(target, p, newValue, receiver) {

                // number indices or 'length' property
                if (p == "length" || !Number.isNaN(Number(p))) target[p] = newValue; 

                // css properties
                else {
                    (<any>target)[p] = newValue;
                    if (!target.includes(p)) target.push(PlaceholderCSSStyleDeclaration.toKebabCase(<string>p));
                }

                return true;
            }
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


export function addStyleSheet(element:HTMLElement|ShadowRoot, url:string|URL) {
    return new Promise<void>((resolve, reject)=>{
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.onload = ()=>resolve();
        link.onerror = ()=>reject();
        link.href = url.toString();
        element.appendChild(link)
    })

}