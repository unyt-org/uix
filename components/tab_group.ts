// deno-lint-ignore-file no-namespace
import { Group } from "./group.ts"
import { Component, NoResources, Group as UIXGroup } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { Handlers } from "../base/handlers.ts";
import { Types } from "../utils/global_types.ts";
import { Datex, text, transform } from "unyt_core";
import { Utils } from "../base/utils.ts";
import { Resource } from "../utils/resources.ts";
import { Files } from "../base/files.ts";
import { I, S } from "../uix_short.ts";
import { logger } from "../utils/global_values.ts";
import { FileEditor } from "./file_editor.ts";
import { Webpage } from "./webpage.ts";


export namespace TabGroup {
    export interface Options extends Group.Options {
        header_location?:"left"|"right"|"top"|"bottom",
        editable?:boolean // elements inside can be edited
        header_type?:"default"|"small",
        header_centered?:boolean,
        header_title?:string,
        header_bg_color?:Datex.CompatValue<string>,
        selected_tab_index?: number,
        show_flags?: boolean,
        add_btn?: boolean, // show element add (+) button
        no_elements_string?: string
    }
}

@UIXGroup("Groups")
@Component<TabGroup.Options>({
    editable:true,
    header_location:"top",
    name: "tab_group",
    enable_drop: true,
    bg_color: "transparent",
    border: false,
    show_flags: true,
    add_btn: true,
    selected_tab_index: 0,
    fill_content: true,
    responsive: true
})
export class TabGroup<O extends TabGroup.Options = TabGroup.Options, ChildElement extends Base = Base> extends Group<O, ChildElement> {

    declare protected header_element:HTMLElement
    declare private add_tab_btn:HTMLDivElement

    protected tab_titles: HTMLElement[] = [];

    private moving_tab:HTMLDivElement = null;

    declare private no_elements_div:HTMLDivElement

    protected elements_by_tab_title = new Map<HTMLElement, ChildElement>()


    protected override onAnchor() {
        if (this.options.editable) TabGroup.setLastActiveGroup(this);
    }

    private static _last_active_tab_group:TabGroup; // # not working

    public static getLastActiveGroup(){
        return this._last_active_tab_group;
    }

    protected static setLastActiveGroup(group:TabGroup){
        this._last_active_tab_group = group;
    }

    public async addFileElement(resource:string|Resource) {
        let file_editor = await Files.createFileElement(resource, {gw:2, gh:2, margin:0});
        this.addChild(<ChildElement>file_editor, {}, true)
    }

    override onChildElementFocused(element: ChildElement) {
        this.showTab(element);
    }

    
    override onNewElement(element:ChildElement) {
        // TODO reenable tab with same identifier exists?

        this.addTabTitle(element);

        // show tab if selected_tab_index
        if (this.options.selected_tab_index == this.elements.indexOf(element)) element.focus();
        // else hide
        else element.hide();

        if (this.options.responsive) this.updateResponsive(true); // make sure selected tabs are updated correctly (e.g. responsive bottom menu in ListGroup)

        return this.elements.indexOf(element);
    }

    protected createTitleElement(element:ChildElement): HTMLElement{

        const index = this.elements.indexOf(element);

        const is_vertical = this.options.header_location == "left" || this.options.header_location == "right"
        const is_header_first = this.options.header_location == "left" || this.options.header_location == "top"

        const close_btn = document.createElement("button");
        close_btn.classList.add("c-button");
        close_btn.innerHTML = '×'

        const title_div = document.createElement("div");
        if (this.options.header_type!='small') title_div.style.minHeight = '27px';
        Utils.setElementHTML(title_div, element.options.$$.title);

        const icon_div = document.createElement("div");
        icon_div.style.marginRight = '4px';
        Utils.setElementHTML(icon_div, transform([element.icon_dx], (s)=>I(s)));

        const state_div = document.createElement("div");
        state_div.style.marginRight = '4px';
        state_div.style.display = 'none';
        state_div.innerText = '●'

        const inner_container = document.createElement("div");
        inner_container.style.position = "relative";
        inner_container.style.display = "flex";
        inner_container.style.alignItems = "baseline";

        inner_container.append(state_div)
        inner_container.append(icon_div)

        if (element.options.title_color != null) {
            Utils.setCSSProperty(title_div, 'color', element.options.title_color);
            Utils.setCSSProperty(icon_div, 'color', element.options.title_color);
        }


        const t = document.createElement("div");
        t.setAttribute("tabindex", "-1");
        t.classList.add("tab-title");
        if (this.options.header_type=='small') t.classList.add("small");
        t.append(inner_container);
       

        if (is_vertical) {
            state_div.style.position = "absolute";
            state_div.style.left = is_header_first ? "7px" : "-5px";
            state_div.style.bottom = "-7px";

            if (!element.icon) {
                title_div.style.display = "block"
                Utils.setElementHTML(title_div, transform([element.title_dx], v=>v?.[0]??'?'))
                title_div.innerHTML = element.title?.[0] ?? '?';
            }
            else {
                icon_div.style.display = "block";
                title_div.style.display = "none";
            }


            close_btn.style.display = "none";
            icon_div.style.marginRight = "0";

            title_div.style.marginBottom = "2px";
            title_div.style.width = "40px";
            title_div.style.minHeight = "40px";
            title_div.style.padding = "0";
            title_div.style.display = "flex";
            title_div.style.justifyContent = "center";
            title_div.style.alignItems = "center";

            t.style.width = "40px";
            t.style.height = "40px";
            t.style.boxSizing = "border-box";
            t.style.display = "flex";
            t.style.justifyContent = "center";
            t.style.padding = "0";
            inner_container.style.alignItems = "center";

            // scale on hover
            t.classList.add('scaling');

            const direction = this.options.header_location == "left" ? "right" : "left";

            let hide:Function;
            t.addEventListener("mouseenter", ()=>{
                let rect = t.getBoundingClientRect();
                hide = Handlers.showTooltip(element instanceof FileEditor ? Files.formatFileName(element.title) : element.title?.toString(), direction == 'right' ? rect.left+rect.width+5 : rect.left-5, rect.top+rect.height/2+2, direction).hide
            })
            // hide tooltip
            t.addEventListener("mouseleave", ()=>{
                if (hide) hide()
                hide = null;
            })
        }

        else {
            inner_container.append(title_div);
        }

        if (!is_vertical && this.options.editable && element.options.removable) {
            t.append(close_btn);
            close_btn.addEventListener("click", ()=>this.removeElement(element));
        }

        // click listeners
        t.addEventListener("mousedown", ()=>element.focus());


        t.addEventListener("keydown", (e)=>{
            if ((is_vertical && e.key=="ArrowDown") || (!is_vertical && e.key=="ArrowRight")) {
                this.elements[this.elements.indexOf(element)+1]?.focus()
            }
            else if ((is_vertical && e.key=="ArrowUp") || (!is_vertical && e.key=="ArrowLeft")) {
                this.elements[this.elements.indexOf(element)-1]?.focus()
            }
        });

        // TODO
        // // move listeners
        // if (this.options.editable && !is_vertical) {
        //     t.addEventListener("mousedown", e => {
        //         this.moving_tab = t;
        //         let move_start_x = e.clientX;
        //         let move_start_y = e.clientY;

        //         let drag_off = false;
        //         this.moving_tab.setAttribute("draggable","true")

        //         // tab moving

        //         $("body").off("mousemove").on("mousemove drag", e => {
        //             if (this.moving_tab) {

        //                 if (!drag_off && Math.abs(move_start_x-e.clientX) > 2) {

        //                     this.moving_tab.setAttribute("draggable","false")
        //                     drag_off = true;
        //                     // this.moving_tab = false;
        //                 }

        //                 let x = this.moving_tab.getBoundingClientRect().left;

        //                 for (let tab of this.tab_titles) {
        //                     let tab_x = tab.getBoundingClientRect().left;
        //                     if (x>tab_x && x < tab_x+20) {
        //                         let new_tab_index = Array.from(tab.parentNode.children).indexOf(tab); // get index in parent
        //                         let moving_tab_index = Array.from(this.moving_tab.parentNode.children).indexOf(this.moving_tab); // get index in parent

        //                         this.moving_tab.style.setProperty("transform", "none");
        //                         this.moveTabToIndex(moving_tab_index, new_tab_index)
        //                         let delta = x-this.moving_tab.getBoundingClientRect().left
        //                         this.moving_tab.style.setProperty("transform", "translateX("+(delta)+"px)");
        //                         move_start_x = e.clientX - delta;
        //                         return;
        //                     }
        //                 }

        //                 this.moving_tab.style.setProperty("transform", "translateX("+(e.clientX-move_start_x)+"px)");

        //             }
        //         })

            

        //     });

        //     function mouseEnd(){
        //         //if (!this.moving_tab) return;
        //         this.moving_tab.css("transform", "none");
        //         this.moving_tab.removeAttr("draggable")
        //         this.moving_tab = false;
        //     }

        //     document.body.addEventListener("mouseup", mouseEnd);
        //     document.body.addEventListener("mouseleave", mouseEnd);
        // }

        // // focus on tab on drag (delay 1s)
        // t.addEventListener("dragenter", ()=>{
        //     setTimeout(()=>{this.showTab(element.constraints.index)}, 200);
        // })

        return t;
    }


    dirty_color = "#4890d3";
    error_color = "var(--red)";
    recording_color = "#e5806d"
    active_color = "var(--green)"

    protected addTabTitle(element:ChildElement){

        const tab_title = this.createTitleElement(element);
        const index = this.elements.indexOf(element);
        this.tab_titles[index] = tab_title;
        this.elements_by_tab_title.set(tab_title, element);
        this.appendTitleElement(tab_title, element)

        setTimeout(()=>this.header_element.scrollLeft = this.header_element.getBoundingClientRect().width, 100);
    }

    #max_tab_index = 0;

    // @override adds tab title entry to DOM
    protected appendTitleElement(tab_title:HTMLElement, element: ChildElement, container:HTMLElement = this.header_element) {

        // tab sorting
        const own_index = this.elements.indexOf(element);
        // tab comes after the currently added tabs
        if (own_index >= this.#max_tab_index) {
            container.append(tab_title);
            this.#max_tab_index = own_index
        }
        // insert tab at right location
        else {
            // find first possible tab from bottom up which comes before this tab, and insert the tab after
            let inserted = false; // was inserted after sibling
            for (let other_tab_title of [...container.children].reverse()) {
                const other_index = this.elements.indexOf(this.elements_by_tab_title.get(<HTMLElement> other_tab_title));
                if (other_index < own_index) {
                    other_tab_title.after(tab_title);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) container.prepend(tab_title); // insert as first element
        }
    }


    public addTabToIndex(tab_index:number, new_index:number){

    }


    // hides all inactive tabs and shows the active tab
    private hideInactiveTabs(){
        for (let element of this.elements){
            if (element==this.active_element) element?.show()
            else element?.hide()
        }
        for (let t of this.tab_titles){
            t?.classList.remove("active")
        }
    }

    public override async replaceElement(index:number|ChildElement, with_index:number|ChildElement) {
        let result_index = await super.replaceElement(index, with_index);
        // if (result_index != -1 ){
        //     this.assignTabTitleElement(this.tab_titles[result_index], this.elements[result_index]);
        // }

        // hide dom element if not in focus
        if (this.options.selected_tab_index!==result_index) this.elements[result_index].style.display = "none";

        return result_index;
    }

    public override showChildIfActive(element: ChildElement){
        if (this.active_element == element) element.style.display = "flex";
    }

    public moveTabToIndex(index:number, to_index:number)
    public moveTabToIndex(movable:ChildElement, to_index:number)

    public moveTabToIndex(index:number|ChildElement, to_index:number): boolean {
        console.log("move from " + index + " to " + to_index)
        index = index instanceof Base ? this.elements.indexOf(index) : index;
        if (index < 0) throw "Tab index must be > 0";
        if (index > this.current_max_index) throw "Tab index too big"; // too far to the right

        let el = this.elements[index];
        let tab_title = this.tab_titles[index];


        // same with tab titles
        this.tab_titles.splice(index,1);
        this.tab_titles.splice(to_index, 0, tab_title)

        if (this.options.selected_tab_index == index) this.options.selected_tab_index = to_index

        // todo
        // if (to_index-1>=0) this.tab_titles[to_index].insertAfter(this.tab_titles[to_index-1])
        // else this.tab_titles[to_index].insertBefore(this.tab_titles[to_index+1])

        return true;
    }

    /**
     * put an existing tab in focus
     * @param index
     * @param identifier
     * @returns if the tab exists
     */
    private showTab(index:number): ChildElement|null
    private showTab(movable:ChildElement): ChildElement|null
    private showTab(index:number|ChildElement): ChildElement|null {

        if (index == null) return null;
        index = index instanceof Base ? this.elements.indexOf(index) : index;
        if (index < 0 || index > this.tab_titles.length-1) return null;

        this.options.selected_tab_index = index;

        if (!this.tab_titles[index]) {
            logger.error("invalid tab index: " + index);
            return null;
        }


        const element = this.elements[index];

        this.active_element = element;

        // already an tab element focused?
        if (this.active_element !== element) return this.active_element;

        this.hideInactiveTabs();

        // this.elements_by_index.get(index).dom_element.css("display", "flex");
        this.tab_titles[index].classList.add("active")
        this.tab_titles[index].focus();

        //setTimeout(()=>el?.focusContent(),1000);

        //UIX.Actions.setAddressBarPath(element.options.identifier, element.options.title)

        this.onTabSelected(index, element);

        return element;
    }


    // @implement called when tab put in focus
    protected onTabSelected(index:number, element:Base) {}


    protected removeTabTitle(index:number) {
        if (!this.tab_titles[index]) {
            logger.error("tabtitle  " + index + " does not exist");
            return;
        }
        this.tab_titles[index].remove()
        this.tab_titles.splice(index, 1);


        // adjust tab_in_focus index
        if (this.options.selected_tab_index>index) this.options.selected_tab_index--

        // focus on new tab
        if (this.options.selected_tab_index == index) {
            if (this.elements[index]) this.elements[index].focus();
            else if (this.elements[index-1]) this.elements[index-1].focus();
        }

    }

    private unlinkTab(index:number) {
        console.warn("unlink", index, this.tab_titles, this.elements[index])
        if (!this.tab_titles[index]) {
            logger.error("tab  " + index + " does not exist");
            return;
        }
        this.tab_titles[index].remove()
        this.tab_titles.splice(index, 1);

        // show if hidden
        this.elements[index].style.display = "flex";

        // focus on new tab
        if (this.options.selected_tab_index == index) {
            if (this.elements[index]) this.elements[index].focus();
            else if (this.elements[index-1]) this.elements[index-1].focus();
        }
    }


    override onElementUnlinked(element:ChildElement) {
        this.unlinkTab(this.elements.indexOf(element))
    }

    override removeElement(element:ChildElement) {
        if (!element) return false;
        const index = this.elements.indexOf(element);
        super.removeElement(element);
        this.removeTabTitle(index);
    }


    createAddMenu() {
        return Utils.getElementAddItems(element_class=>{
            console.warn("add in tabgrouop", element_class)
            this.addChild(element_class, {}, true);
        });
    }

    override handleHasNoChildElements(){
        if (this.no_elements_div) this.no_elements_div.style.display = "flex";
    }

    override handleHasChildElements(){
        if (this.no_elements_div) this.no_elements_div.style.display = "none";
    }

    override onCreateLayout() {

        let is_vertical = this.options.header_location == "left" || this.options.header_location == "right"
        let is_header_first = this.options.header_location == "left" || this.options.header_location == "top"

        this.style.flexDirection = is_vertical ? "row" : "column";

        let full_header = document.createElement("div");
        //full_header.style.overflow = "hidden";
        full_header.style.display = "flex";
        full_header.style.flexDirection = is_vertical ? "column": "row";

        this.header_element = document.createElement("div");
        this.header_element.classList.add('tab-header');

        this.content_container.style.position = 'relative';
        this.content_container.style.flexGrow = '1'

        // header (title)
        if (this.options.header_title) full_header.innerHTML = `<h3 style="margin-bottom: 2px;display: flex;align-items: center;margin: 0;margin-right: 20px;">${this.options.header_title}</h3>`;
        // center header
        if (this.options.header_centered) {
            full_header.style.alignItems = "center";
            full_header.style.justifyContent = "center";
        }
        if (this.options.header_type=='small') {
            this.header_element.style.borderRadius = "0";
        }

        let add_tab_btn_button:HTMLButtonElement;
        // vertical
        if (is_vertical) {
            this.add_tab_btn = document.createElement("div");
            this.add_tab_btn.style.display = "flex";
            this.add_tab_btn.style.justifyContent = "center";

            add_tab_btn_button = document.createElement("button");
            add_tab_btn_button.classList.add("c-button", "big");
            add_tab_btn_button.innerHTML = I`fa-plus`;
            add_tab_btn_button.style.marginRight = "8px";
            this.add_tab_btn.append(add_tab_btn_button)

            if (is_header_first) {
                this.header_element.style.flexDirection = "column"
                this.header_element.style.marginRight = "4px"
                this.header_element.style.marginLeft = "4px"
            }
            else {
                this.header_element.style.flexDirection = "column"
                this.header_element.style.marginRight = "4px"
                this.header_element.style.marginLeft = "4px"
            }
        }
        // horizontal
        else {
            this.add_tab_btn = document.createElement("div");
            this.add_tab_btn.style.height = "100%";
            this.add_tab_btn.style.display = "flex";
            this.add_tab_btn.style.alignItems = "center";
            
            add_tab_btn_button = document.createElement("button");
            add_tab_btn_button.classList.add("c-button", "big");
            add_tab_btn_button.innerHTML = I`fa-plus`;
            this.add_tab_btn.append(add_tab_btn_button)
            
            this.header_element.style.flexDirection = "row"
            if (!is_header_first) {
                this.header_element.style.marginTop = "2px"
                this.header_element.style.marginBottom = "0px"
            }
        }

        // hide add button?
        if (!this.options.editable || !this.options.add_btn) this.add_tab_btn.style.display = "none"

        // assemble

        full_header.append(this.header_element);
        full_header.append(this.add_tab_btn)

        // this.content_container.append(this.slot_element)

        if (is_header_first) {
            this.shadow_root.append(full_header)
            this.shadow_root.append(this.content_container)
        }
        else {
            this.shadow_root.append(this.content_container)
            this.shadow_root.append(full_header)
        }

        this.no_elements_div = document.createElement("div");
        this.no_elements_div.style.position = 'absolute';
        this.no_elements_div.style.width = '100%';
        this.no_elements_div.style.height = '100%';
        this.no_elements_div.style.display = 'flex';
        this.no_elements_div.style.flexDirection = 'column';
        this.no_elements_div.style.fontSize = '1.2em';
        this.no_elements_div.style.color = this.text_color_light;
        this.no_elements_div.style.alignItems = 'center';
        this.no_elements_div.style.justifyContent = 'center';

        (async ()=>Utils.setElementHTML(this.no_elements_div, await text `<span style='font-size:2em'>${I('fa-th')}</span><span>${S(this.options.no_elements_string ?? 'no_elements')}</span>`))()
        
        this.content_container.append(this.no_elements_div)

        Handlers.contextMenu(add_tab_btn_button, this.createAddMenu(), null, null, ["contextmenu", "mousedown"]);

        Handlers.handleDrop(add_tab_btn_button, {drop: async (drop_event)=> {

                if (drop_event.types.has(Types.DRAGGABLE.ELEMENT_CREATOR)) {
                    let data = drop_event.data[Types.DRAGGABLE.ELEMENT_CREATOR];

                    // only a single file - add to group
                    if (data.type=="single") {
                        let drop_el = await data.get();
                        if (drop_el) this.addChild(<ChildElement>drop_el, {}, true);
                    }

                    // handle multiple files at once
                    else if (data.type=="multiple") {
                        let elements = await data.getAll();
                        for (let el of elements) this.addChild(<ChildElement>el, {}, true);
                    }

                }

                else if (drop_event.types.has(Types.DRAGGABLE.ELEMENT)) {
                    this.addChild(<ChildElement>drop_event.data[Types.DRAGGABLE.ELEMENT], {}, true);
                }

                else if (drop_event.types.has(Types.DRAGGABLE.TREE_ITEM)) {
                    let entry = Resource.get(<string>drop_event.data[Types.DRAGGABLE.TREE_ITEM]);
                    let children:Set<Resource> = await entry.children
                    if (children) {
                        for (let child of children) {
                            if (!child.is_directory) await this.addFileElement(child);
                        }
                    }
                    else {
                        this.addFileElement(entry);
                    }
                }

                else if (drop_event.types.has(Types.DRAGGABLE.URL)) {
                    this.addChild(Webpage, {url: drop_event.data[Types.DRAGGABLE.URL]}, true);
                }

        }})

    }


}
