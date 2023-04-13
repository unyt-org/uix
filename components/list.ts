// deno-lint-ignore-file no-namespace
import { Component, NoResources } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { Datex } from "unyt_core";
import { HTMLUtils } from "../html/utils.ts";

import { I, S } from "../uix_short.ts";
import { Elements } from "../elements/main.ts";
import { Types } from "../utils/global_types.ts";
import { Snippets } from "../base/snippets.ts";

export namespace List {

    export type list_view_entry = {
        id?: string|number,
        title?:string,
        body?: string|HTMLElement|(string|HTMLElement)[]
    }

    export interface Options extends Base.Options {
        header?: boolean // show a header
        show_title?: boolean // show totle in header
    }

}

// TODO List View extends List?
@Component<List.Options>({
    vertical_align:Types.VERTICAL_ALIGN.TOP, 
    horizontal_align:Types.HORIZONTAL_ALIGN.LEFT, 
    padding:10,
    show_title: true
})
export class List<O extends List.Options = List.Options> extends Base<O> {

    list_container: HTMLDivElement
    current_index:number

    
    private column_widths: string[]
    private column_backgrounds: boolean[]
    protected entries: List.list_view_entry[] = []
    protected entry_doms: HTMLDivElement[] = []


    override onCreate(){
        this.list_container = document.createElement("div");
        this.list_container.classList.add('list-container');
        this.list_container.setAttribute("tabindex", "0");

        this.content.style.display = "flex";
        this.content.style.flexDirection = "column";

        this.list_container.addEventListener("keydown",  e => {
            if (e.key == "ArrowUp" || (e.key == "Tab" && e.shiftKey)) this.selectPrevious()
            else if (e.key == "ArrowDown" || e.key == "Tab") this.selectNext()
            else return;
            e.preventDefault();
        })
        

        if (this.options.header) {
            let entries:Elements.Header.ElementData[] = [
                {element:new Elements.Button({content: I`fa-sync-alt`, onClick:()=>this.sync()})},
                {element:new Elements.Button({content: I`fa-trash`, onClick:()=>this.clear()})},
                {element:new Elements.TextInput(undefined, {placeholder:"Filter"}), align:'end'},
            ];
            if (this.options.show_title) entries.unshift({element:HTMLUtils.createHTMLElement(`<h4 style='font-size: 1.2em;color: var(--text_highlight);margin: 0;line-height: 1.4em;'>${this.options.title??""}</h4>`)})
            this.header = new Elements.Header(entries, {margin_bottom:true, seperator:true, gaps:4})
        }

        this.content.append(this.makeScrollContainer(this.list_container));

       
    }


    protected setColumnWidths(column_widths:string[]) {
        this.column_widths = column_widths;
    }

    // has column background or not?
    protected setColumnBackgrounds(column_backgrounds:boolean[]) {
        this.column_backgrounds = column_backgrounds;
    }

    addEntry(entry:List.list_view_entry){

        const index = this.entries.push(entry)-1;

        const entry_dom = document.createElement("div");
        entry_dom.classList.add('list-entry');
        this.entry_doms[index] = entry_dom;

        let i = 0;
        for (const e of (!(entry.body instanceof Array) ? [entry.body] : entry.body||[])) {
            const container = document.createElement("div");
            container.classList.add('list-entry-value')
            if (this.column_backgrounds && !this.column_backgrounds[i]) container.classList.add('no-bg');
            if (this.column_widths&&this.column_widths[i]) container.style.width = this.column_widths[i];
            if (e) container.append(e);
            entry_dom.append(container);
            i++;
        }

        this.list_container.append(entry_dom)

        entry_dom.addEventListener("click", ()=>{
            this.selectEntry(index);
        })

    }

    clear(){
        this.entries = [];
        this.list_container.innerHTML = "";
        if (this.onClear) this.onClear(); 
    }

    sync(){
        if (this.onSync) this.onSync(); 
    }

    selectEntry(index:number):boolean {
        if (!this.entries[index]) return false;
        this.current_index = index;
        for (let entry of this.shadow_root.querySelectorAll('.list-entry')) entry.classList.remove('active');
        this.entry_doms[index].classList.add("active");
        if (this.onEntrySelected) this.onEntrySelected(this.entries[index]);
        return true;
    }

    selectNext():boolean{
        return this.selectEntry(this.current_index+1)
    }
    selectPrevious():boolean{
        return this.selectEntry(this.current_index-1)
    }
    selectLast():boolean{
        return this.selectEntry(this.entries.length-1)
    }

    // can be implemented
    onEntrySelected(entry:List.list_view_entry) {}
    // can be implemented
    onClear() {}
    onSync() {}

}