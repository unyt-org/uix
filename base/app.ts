import { Datex } from "unyt_core";
import { constructor, property, replicator, type } from "unyt_core/datex_all.ts";
import { Components } from "../components/main.ts";
import { Elements } from "../elements/main.ts";
import { window } from "../utils/constants.ts";

export let UIX_APP:UIXAppInstance;

export class UIXAppInstance extends Elements.Base {

    @property @type(Datex.Type.std.text) name!: string
    @property @type(Datex.Type.std.Set)  sections:Set<Components.Base> = new Set();
    @property @type(Datex.Type.std.text) current_section!: string // TODO string or number

    #pages_by_id:Map<string|number, Components.Base> = new Map();
    #page_id_count = 0;

    constructor(name:string, pages:Components.Base[], start_page?:string) {
        super();
        this.style.width = "100%";
        this.style.height = "100%";
        UIX_APP = this;
    }

    @constructor construct(name:string, pages:Components.Base[], start_page?:string){
        this.name = name || this.getAttribute("name");
        this.current_section = start_page || this.getAttribute("active_page") || (pages && Object.keys(pages)[0]);

        // add pages to this.pages
        if (pages) { for (let page of pages) this.sections.add(page); }

        this.init()
    }

    @replicator replicate(){
        this.init()
    }

    // add all pages from this.pages to DOM
    init(){
        for (let page of this.sections) this.addPage(page);
    }

    addPage(page:Components.Base){
        this.append(page);
        this.handleNewPage(page);
    }

    handleNewPage(page:Components.Base) {
        if (!("id" in page.options)) page.options.id = (this.#page_id_count++).toString(); 
        this.sections.add(page);
        this.#pages_by_id.set(page.options.id, page);

        this.updatePages();
    }

    showPage(page_id:string|number) {
        page_id = page_id.toString(); // make sure id is a string
        if (!this.#pages_by_id.has(page_id)) throw "Page '" + page_id + "' does not exist in this app";
        this.current_section = page_id;
        console.log("active page is", this.current_section)
        this.updatePages();
    }

    updatePages() {
        for (let page of this.sections) {
            if (this.current_section == page.options.id) page.show();
            else page.hide()
        }
    }


    getPage(page_id:string|number) {
        return this.#pages_by_id.get(page_id)
    }

    getActivePage() {
        return this.getPage(this.current_section)
    }


    // TODO:
    getSkeleton() {
        return `<${this.tagName.toLowerCase()}></${this.tagName.toLowerCase()}>`
    }

}

window.customElements.define("uix-app", UIXAppInstance) // set original _App class as component

export const AppInstance = <typeof UIXAppInstance&(new (...args: any[]) => any)><any>Datex.createTemplateClass(UIXAppInstance, Datex.Type.get("uix:app"));
