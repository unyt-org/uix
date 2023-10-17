export class CSSStyleDeclaration extends Array /*implements CSSStyleDeclaration*/ {
    
    [name:string]: string|Function|number|null

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
        return this[CSSStyleDeclaration.toCamelCase(property)] as string
    }
    removeProperty(property: string): string {
        const name = CSSStyleDeclaration.toCamelCase(property);
        const val = this[name] as string;
        delete this[name];

        const index = this.indexOf(property);
        if (index != -1) this.splice(index, 1);

        return val;
    }
    setProperty(property: string, value: string | null) {
        if (!this.includes(property)) this.push(property);
        
        this[CSSStyleDeclaration.toCamelCase(property)] = value;
    }

    item(index:number) {
        if (typeof index != "number") return undefined;
        return this[index];
    }

    get cssText() {
        const css = [];
        for (let i = 0; i < this.length; i++) {
            const key = this.item(i);
            css.push(`${key}: ${this[CSSStyleDeclaration.toCamelCase(key)]};`);
        }
        return css.join(" ");
    }

    set cssText(css: string) {
        this.length = 0;
        for (const entry of css.split(";")) {
            const [prop, value] = entry.split(":").map(s=>s.trim())
            if (prop) this.setProperty(prop, value)
        }
    }

    private constructor(){
        super();
    }


    static create():CSSStyleDeclaration{
        const dec = new CSSStyleDeclaration();
        return <CSSStyleDeclaration><any> new Proxy(dec, {
            set(target, p, newValue, receiver) {

                // number indices or 'length' property
                if (p == "length" || p == "cssText" || typeof p == "symbol" || !Number.isNaN(Number(p))) (target as any)[p] = newValue; 

                // css properties
                else {
                    (<any>target)[CSSStyleDeclaration.toCamelCase(p)] = newValue;
                    const kebabProp = CSSStyleDeclaration.toKebabCase(<string>p);
                    if (!target.includes(kebabProp)) target.push(kebabProp);
                }

                return true;
            },
            get(target, p, receiver) {
                // number indices or 'length' property
                if (p == "length" || p == "cssText" || typeof p == "symbol" || !Number.isNaN(Number(p))) return (target as any)[p]; 
                else {
                    return target[CSSStyleDeclaration.toCamelCase(<string>p)];
                }
            },
        })
    }
}
