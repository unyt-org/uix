import { Component, NoResources, Group as UIXGroup } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { Datex } from "unyt_core";
import { Utils } from "../base/utils.ts";

import { I, S } from "../uix_short.ts";
import { Theme } from "../base/theme.ts";
import { TabGroup } from "./tab_group.ts";
import { Elements } from "../elements/main.ts";
import { document } from "../utils/constants.ts";
import { Element } from "../base/decorators.ts";


@Element class BottomMenu extends Elements.ValueSelect<Elements.ValueSelect.Options, string> {
    options_container!: HTMLElement;

    constructor(list:Datex.CompatValue<Iterable<[string, string]>> = [], options?:Elements.ValueSelect.Options){
        super(options);
        this.init(list)
    }

    createLayout(){
        this.options_container = document.createElement("div");

        this.options_container.style.marginTop = "10px";
        this.options_container.style.display = "flex";
        this.options_container.style.justifyContent = "space-between";

        this.style.width = "100%";

        this.append(this.options_container)
    }

    protected generateOptionHTMLElement(entry: string, key:number, value:string) {
        const element = <Base> Datex.Pointer.get(value)?.val;

        const menu_entry = document.createElement("div");
        menu_entry.style.display = 'flex';
        menu_entry.style.justifyContent = 'center';
        menu_entry.style.flex = '1 1 0';
        menu_entry.style.margin = '2px';
        menu_entry.style.backgroundColor = 'transparent';

        const icon_div = Utils.createHTMLElement(`<div style="font-size:24px;margin-bottom:5px"></div>`);
        Utils.setElementHTML(icon_div, element.icon_dx)

        menu_entry.append(Utils.createHTMLElement(`<div style='width:100%;height:100%;display:flex;flex-direction:column;align-items:center'></div>`, [
            icon_div,
            Utils.createHTMLElement(`<div style="font-size:12px"></div>`, element.short_title_dx),
        ]));

        // set selected entry
        menu_entry.addEventListener("mousedown", (e)=>{
            this.selected_option_index.val = key;
            e.stopPropagation();
            this.focusEntry(menu_entry, element);
        })

        // is currently selected
        if (key == this.selected_option_index.val) this.focusEntry(menu_entry, element);

        return menu_entry;
    }

    protected focusEntry(menu_entry:HTMLElement, element:Base){
         // reset others
         for (const child of <Iterable<HTMLElement>><unknown>this.options_container.children) {
            child.style.color = "";
        }
        menu_entry.style.color = element.options.accent_color ?? 'var(--accent)';
    }

}

export namespace ListGroup {
    export interface Options extends TabGroup.Options {
        dynamic_header_size?: boolean
        menu_background?: string, // bg color for left menu
        menu_border?: boolean|number // menu border
        blur_background?: boolean,
        _collapsed_groups?: string[],
        responsive_bottom_menu?: boolean, // show menu bar at the bottom in portrait mode
    }
}

// dynamically show elements when item from list is selected
@UIXGroup("Groups")
@Component<ListGroup.Options>({
    header_bg_color: Theme.getColorReference('bg_dark'),
    //background_color: 'UIX.Theme.background_default',
    dynamic_header_size: false,
    border: true,
    enable_ctx: false,
    menu_background: Theme.getColorReference('bg_default'),
})
export class ListGroup<O extends ListGroup.Options = ListGroup.Options, ChildElement extends Base = Base> extends TabGroup<O, ChildElement> {
    
    menu!: HTMLElement;
    nav_title!: HTMLElement;
    nav_button!:HTMLElement
    nav_bottom_menu!:HTMLElement

    expanded = false;

    protected override onTabSelected(index:number, element:Base) {
        if (this.nav_title) Utils.setElementHTML(this.nav_title, element.options.$$.title);
        if (!this.portrait_mode.val) return;
        this.collapseMenu();
    }

    private toggleMenu(){
        if (this.expanded) this.collapseMenu()
        else this.expandMenu();
    }

    private expandMenu(){
        this.menu.style.setProperty('display', 'flex');
        this.expanded = true;
    }

    private collapseMenu(){
        this.menu.style.setProperty('display', 'none');
        this.expanded = false;
    }


    override onCreateLayout() {
        const offset = 300;

        this.style.flexDirection = "row"
        this.style.width = "auto";

        const border = typeof this.options.menu_border == "number" ? this.options.menu_border : (this.options.menu_border ? 2 : null);

        this.menu = document.createElement("div");
        
        this.menu.style.setProperty('display','flex');
        this.menu.style.setProperty('flex-direction','column');
        Utils.setCSSProperty(this.menu, 'background', this.options.$$.menu_background);
        this.menu.style.setProperty('border',border ? border+'px solid var(--border_color)' : 'none');
        this.menu.style.setProperty('border-radius','10px');
        this.menu.style.setProperty('left','0px');
        this.menu.style.setProperty('height','calc(100% - 40px)');
        this.menu.style.setProperty('margin-top','20px');
        this.menu.style.setProperty('margin-right','-40px');
        this.menu.style.setProperty('transform','translateX(-40px)');

        // fixed default width
        if (!this.options.dynamic_header_size) this.menu.style.width = offset + 'px';

        this.header_element = document.createElement("div");
        this.header_element.style.paddingTop = '8px';
        this.header_element.style.color = "var(--text_highlight)";

        this.content_container.style.position = "relative";
        this.content_container.style.flexGrow = "1";
        this.content_container.style.flexDirection = "row";

        if (this.options.blur_background) this.content_container.style.backdropFilter = "blur(1px)"

        // header (title)
        if (this.options.header_title) this.menu.insertAdjacentHTML('beforeend', `<h3 style="margin-bottom: 2px;display: flex;align-items: center;margin: 0;margin-right: 20px;">${this.options.header_title}</h3>`)
        // center header
        if (this.options.header_centered) {
            this.menu.style.setProperty("align-items","center")
            this.menu.style.setProperty("justify-content","center");
        }

        if (this.options.header_type=='small') this.header_element.style.borderRadius = '0';

        this.header_element.style.flexDirection = 'column';

        // assemble

        this.menu.append(this.makeScrollContainer(this.header_element));

        this.content_container.append(this.menu)
        this.content_container.append(this.slot_element)

        this.addEventListener("click", e=>{
            if (this.options.editable) TabGroup.setLastActiveGroup(this)
        });


        // nav menu for portrait mode
        // bottom bar menu
        if (this.options.responsive_bottom_menu) {
            this.nav_bottom_menu = document.createElement("div");
            // this.nav_bottom_menu.style.display = "none";
            this.shadow_root.append(this.nav_bottom_menu)
        }

        // default (top menu)
        else {
            let nav_content = Utils.setCSS(document.createElement("div"), {display:'flex', 'flex-direction': 'row', 'align-items':'center'});
            let nav_icon = Utils.setElementHTML(document.createElement("div"), I('fa-bars'));
            this.nav_title = Utils.setCSS(document.createElement("div"), {'margin-left':'8px'});
            nav_content.append(nav_icon)
            nav_content.append(this.nav_title)
    
            this.nav_button = new Elements.Button({content:nav_content, onClick:()=>this.toggleMenu(), color:'transparent'}).css({width:"100%"});
            this.nav_button.style.marginBottom = "5px";
            this.nav_button.style.display = "none";

            Utils.setCSSProperty(this.nav_button, 'background', this.options.$$.menu_background);
            this.shadow_root.insertBefore(this.nav_button, this.content_container)

        }

        // force remove bg in portrait mode when updated
        Datex.Value.observeAndInit(this.options.background ? this.options.$$.background : this.options.$$.bg_color, ()=>{
            // override if portrait mode
            if (this.portrait_mode.val) {
                // save background
                this.#normal_background = this.content_container.style.background;
                this.content_container.style.background = "transparent";
            }
        })

    }

    
    override updateBorders(){
        if (this.portrait_mode.val) return; //  force remove border/bg
        super.updateBorders();
    }

    // changed to normal mode
    protected override onLayoutModeNormal() {

        this.expanded = false; // reset expandable nav menu

        this.style.flexDirection = "row"

        this.menu.style.setProperty('display', 'flex');
        this.menu.style.setProperty('width', 300 + 'px');
        this.menu.style.setProperty('height','calc(100% - 40px)');
        this.menu.style.setProperty('margin-top','20px');
        this.menu.style.setProperty('margin-right','-40px');
        this.menu.style.setProperty('transform','translateX(-40px)');
        this.menu.style.setProperty('position','relative');

        this.content_container.style.display = 'flex';
        this.content_container.style.width = "calc(100% - 40px)";
        this.content_container.style.height = "100%";
        this.content_container.style.marginLeft = "40px";
        this.content_container.style.overflow = "visible";


        for (let el of this.elements) {
            el.style.padding = "20px";
        }

        if (this.nav_button) this.nav_button.style.display = "none";
        if (this.nav_bottom_menu) this.nav_bottom_menu.style.display = "none";


        if (this.content_container.style.background == "transparent" && this.#normal_background) this.content_container.style.background = this.#normal_background;
        if (this.content_container.style.boxShadow == "none" && this.#normal_box_shadow) this.content_container.style.boxShadow = this.#normal_box_shadow;

        return true;
    }

    #normal_background?:string
    #normal_box_shadow?:string

    // changed to portrait mode
    protected override onLayoutModePortrait() {
        this.style.flexDirection = "column"

        this.menu.style.setProperty('display','none');
        this.menu.style.setProperty('width','100%');
        this.menu.style.setProperty('margin-top','0');
        this.menu.style.setProperty('margin-right','0');
        this.menu.style.setProperty('transform','none');
        this.menu.style.setProperty('height','100%');
        this.menu.style.setProperty('position','absolute');
        this.menu.style.setProperty('z-index','10');

        this.content_container.style.width = "100%";
        this.content_container.style.marginLeft = "0";
        this.content_container.style.overflow = "overlay";

        for (const el of this.elements) {
            el.style.padding = "0";
        }

        if (this.options.responsive_bottom_menu) {
            this.nav_bottom_menu.innerHTML = "";
            const selected_index = this.elements.indexOf(this.active_element);
            this.nav_bottom_menu.append(new BottomMenu(this.elements.map(e=>[e.title, Datex.Pointer.getByValue(e)!.id]), {
                selected_index,
                onChange: (index, value) => {
                    const element = <ChildElement> Datex.Pointer.get(value)?.val;
                    element.focus();
                    console.log("select",index,value);
                },
            }));
            this.nav_bottom_menu.style.display = "block";
        }
        else {
            this.nav_button.style.display = "block";
            let navHeight = this.nav_button.offsetHeight;
            navHeight += parseInt(window.getComputedStyle(this.nav_button).getPropertyValue('margin-top'));
            navHeight += parseInt(window.getComputedStyle(this.nav_button).getPropertyValue('margin-bottom'));

            this.content_container.style.height = "calc(100% - "+navHeight+"px)";
        }

        // save background
        this.#normal_background = this.content_container.style.background;
        this.content_container.style.background = "transparent";

        // save border (box shadow)
        this.#normal_box_shadow = this.content_container.style.boxShadow;
        this.content_container.style.boxShadow = "none";


        return true;
    }


    override adjustChildLayout(element: ChildElement) {
        element.style.position = "relative"        

        if (this.portrait_mode.val) {
            for (let el of this.elements)  el.style.padding = "0";
        }
        else {
            for (let el of this.elements)  el.style.padding = "20px";
        }
    }


    protected override createTitleElement(element:ChildElement){

        const index = this.elements.indexOf(element);

        const title_div = document.createElement("div");
        if (this.options.header_type!='small') title_div.style.minHeight = '27px';
        Utils.setElementHTML(title_div, element.options.$$.title);

        const icon_div = document.createElement("div");
        // icon_div.style.marginRight = '12px';
        if (element.icon) icon_div.style.width = '1.8em';
        Utils.setElementHTML(icon_div, element.options.$$.icon);

        const state_div = document.createElement("div");
        state_div.style.marginRight = '4px';
        state_div.style.display = 'none';
        state_div.innerText = '●'

        const inner_container = document.createElement("div");
        inner_container.style.position = "relative";
        inner_container.style.display = "flex";
        inner_container.style.alignItems = "center";
        inner_container.style.justifyContent = "space-between";

        const title_div_2 = document.createElement("div");
        title_div_2.style.display = "flex";
        title_div_2.style.alignItems = "baseline";

        title_div_2.append(icon_div)
        title_div_2.append(title_div)

        inner_container.append(title_div_2);
        inner_container.append(state_div)

        const t = document.createElement("div");
        t.setAttribute("tabindex", "0");
        t.classList.add("list-item");
        t.append(inner_container);

        Utils.setCSSProperty(t, "--accent-color", element.options.accent_color ?? Theme.getColorReference('accent'))

        // click listeners
        t.addEventListener("mousedown", ()=>{
            element.focus()
        });


        t.addEventListener("keydown", (e)=>{
            if (e.key=="ArrowDown") {
                this.elements[this.elements.indexOf(element)+1]?.focus();
            }
            else if (e.key=="ArrowUp") {
                this.elements[this.elements.indexOf(element)-1]?.focus();
            }
        });

        // focus on tab on drag (delay 1s)
        t.addEventListener("dragenter", ()=>{
            setTimeout(()=>element.focus(), 200);
        })

        return t;
    }

    protected tab_group_elements:Map<string, HTMLElement> = new Map(); // put tab titles in here
    protected tab_group_containers:Map<string, HTMLElement> = new Map(); // outer container for a tab title group
    protected tab_group_min_indices:Map<string, number> = new Map();

    protected override appendTitleElement(tab_title:HTMLElement, element: ChildElement) {
        if (!element.options.group) super.appendTitleElement(tab_title, element);
        else {

            if (!this.options._collapsed_groups) this.options._collapsed_groups = [];

            const group = element.options.group;// instanceof Datex.Value ? element.options.group.val : element.options.group;
            // create group dom
            if (!this.tab_group_elements.has(group)) {
                const dom = Utils.setCSS(document.createElement("div"), {'margin-left':'10px', 'margin-right':'10px'});
                const header = document.createElement("div")
                const body = Utils.setCSS(document.createElement("div"), {'margin-left': '15px', 'margin-bottom': '10px'})
                
                const down_title = Utils.createHTMLElement("<h4 style='margin:0'></h4>", <Datex.Value<string>>element.options.$.group);
                const up_title = Utils.createHTMLElement("<h4 style='margin:0'></h4>", <Datex.Value<string>>element.options.$.group);

                const down = Utils.createHTMLElement(`<div style='margin:0px;display:flex;align-items:center;text-align:left'><div style='width:16px; height:16px'>${I('fa-chevron-down')}</div>&nbsp;&nbsp;</div>`, [down_title]),
                      up   = Utils.createHTMLElement(`<div style='margin:0px;display:flex;align-items:center;text-align:left'><div style='width:16px; height:16px'>${I('fa-chevron-right')}</div>&nbsp;&nbsp;</div>`, [up_title])
                let collapsed = this.options._collapsed_groups.includes(group);
                
                const collapse_update = ()=>{
                    collapsed = !collapsed;
                    if (collapsed) {
                        collapse.innerHTML = "";
                        collapse.append(up);
                        body.style.visibility = "hidden";
                        body.style.height = "0px";
                        body.style.marginBottom = "0px";
                        // add to collapsed groups
                        if (!this.options._collapsed_groups.includes(group)) this.options._collapsed_groups.push(group)
                    }
                    else {
                        collapse.innerHTML = "";
                        collapse.append(down);
                        body.style.visibility = "visible";
                        body.style.height = "initial";
                        body.style.marginBottom = "10px";
                        // remove from collapsed groups
                        if (this.options._collapsed_groups.includes(group)) this.options._collapsed_groups.splice(this.options._collapsed_groups.indexOf(group), 1)
                    }
                }
                const collapse = new Elements.Button({content:down, onClick:collapse_update, color:'transparent'}).css({'margin-right':'5px'})
                if (collapsed) {collapsed = false; collapse_update()} // was loaded as collapsed from JSON state

                header.append(collapse)
                // header.append()
                dom.append(header)
                dom.append(body)
                this.header_element.append(dom);
                this.tab_group_containers.set(group, dom);
                this.tab_group_elements.set(group, body);
            }

            // add to group (sort to right position)
            const own_index = this.elements.indexOf(element);
            const group_element = this.tab_group_elements.get(group);
            
            // update tab group min index
            this.tab_group_min_indices.set(group, Math.min(this.tab_group_min_indices.get(group)??Infinity, own_index));
            for (let [group_name, other_index] of [...this.tab_group_min_indices.entries()].reverse()) {
                if (other_index < own_index) {
                    this.tab_group_containers.get(group_name).after(this.tab_group_containers.get(group));
                    break;
                }
            }

            super.appendTitleElement(tab_title, element, group_element);

            
        }
    }

}