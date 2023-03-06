// deno-lint-ignore-file no-namespace
import { Component, NoResources } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { Datex, text } from "unyt_core";
import { Utils } from "../base/utils.ts";
import { HTMLUtils } from "../html/utils.ts";
import { I, S } from "../uix_short.ts";
import { Elements } from "../elements/main.ts";
import { Types } from "../utils/global_types.ts";
import { Resource, ResourceManger } from "../utils/resources.ts";
import { Semaphore } from "../utils/semaphore.ts";
import { logger } from "../utils/global_values.ts";
import { Sounds } from "../base/sounds.ts";
import { Handlers } from "../base/handlers.ts";
import { TabGroup } from "./tab_group.ts";
import { Files } from "../base/files.ts";


export namespace Tree {
    export interface Options extends Base.Options {
        expanded_paths?: string[],
        root_resource_path?: string,
        header?: boolean // show a header
        search?: boolean // search field?
        display_root?: boolean, // show the root entry?
        line_type?: 'dashed' | 'solid' // show lines in tree view
        font?: string, // css font for the tree (font-size / line-height font-family)
        enable_entry_drag?: boolean, // elements can be dragged out of the tree view
        enable_entry_drop?: boolean, // elements can be dropped into folders
        enable_entry_open?: boolean, // elements are opened when clicked
        enable_entry_edit?: boolean, // entries can be edited
        full_entry_width?:boolean,
        _search_value?: string // current search value
    }
}


@Component<Tree.Options>({
    icon: 'fa-list',
    vertical_align: Types.VERTICAL_ALIGN.TOP,
    horizontal_align: Types.HORIZONTAL_ALIGN.LEFT,
    padding_top: 20,
    padding_left: 20,
    line_type: 'solid',
    header: true,
    enable_entry_drag: true,
    enable_entry_drop: true,
    enable_entry_open: true
})
export class Tree<O extends Tree.Options = Tree.Options> extends Base<O> {

    // filter flags (Can be overriden)
    public FILTER_PATH_DEPTHS:Set<number>|"ALL" = "ALL"; // resource path depth to check filter
    public FILTER_SHOW_INVALID_CHILDREN = false; // show children of a valid value, even if they are invalid
    public FILTER_SHOW_INVALID_SIBLINGS = false; // show siblings of a valid value, even if they are invalid (not on the first level)
    public FILTER_HIDE_INVALID_SIBLINGS_AT_ROOT_LEVEL = true; // if FILTER_SHOW_INVALID_SIBLINGS enabled, don't show invalid siblings at root level

    public CONTEXT_MENU_HEADER_LEFT = false; // context menu header has no left padding

    protected dom_tree:Map<Resource, HTMLElement> = new Map(); // MAP: resource => entry dom element

    protected root_resource: Resource
    protected resource_manager: ResourceManger

    protected outer_el:HTMLElement;
    protected tree_container:HTMLElement

    protected expand_handlers: Map<Resource, Function> = new Map() // cached expand handlers for not yet expanded resource entries


    protected async toggleCollapse(resource:Resource){

        let dom = this.dom_tree.get(resource);
        // is expanded
        if (!dom.classList.contains("collapsed")) {
            this.collapse(resource)
            return false;
        }
        // is collapsed
        else {
            await this.expand(resource, dom.classList.contains("temporary-expand"))
            return true;
        }
    }

    protected collapse(resource_or_path:Resource|string){
        let resource = resource_or_path instanceof Resource ? resource_or_path : Resource.get(resource_or_path)
        this.dom_tree.get(resource)?.classList.add("collapsed");
        if (this.options.expanded_paths?.includes(resource.path)) this.options.expanded_paths.splice(this.options.expanded_paths.indexOf(resource.path),1);
    }


    protected async expand(resource_or_path:Resource|string, temporary_expand = false, parent_references?:Set<any>){
        let resource = resource_or_path instanceof Resource ? resource_or_path : Resource.get(resource_or_path)

        // handle expand, load children, if not yet loaded
        if (this.expand_handlers.has(resource)) {
            await this.expand_handlers.get(resource)(parent_references);
        }
        let dom = this.dom_tree.get(resource);

        // is collapsed or just temporary expanded
        if (dom?.classList.contains("collapsed") || dom?.classList.contains("temporary-expand")) {
            dom?.classList.remove("collapsed");
            dom?.classList.remove("temporary-expand")
            // temporary or permanent expand?
            if (temporary_expand) dom?.classList.add("temporary-expand")
        }

        // add to expanded paths
        if (!temporary_expand && !this.options.expanded_paths?.includes(resource.path)) this.options.expanded_paths.push(resource.path);
    }

    // hide temporary expanded entries again
    protected resetTemporaryExpandedEntries(){
        this.tree_container.querySelectorAll(".temporary-expand").forEach(el=>{
			el.classList.add("collapsed");
			el.classList.remove("temporary-expand")
		});
    }


    // updates the DOM for an entry or adds a new entry
    public async updateEntry(resource:Resource) {

        let dom = this.dom_tree.get(resource);
        let parent_resource = resource.parent;
        if (!parent_resource) return;
        let parent_dom = this.dom_tree.get(parent_resource);

        // entry does not exist, but has parent => re-render all content of parent
        if (!dom && parent_dom && (this.options.expanded_paths.includes(parent_resource.path))) {
            await parent_resource.updateChildren() // force reload children of parent

            await Semaphore.get(parent_resource).execute(async ()=>{
                parent_dom = this.dom_tree.get(parent_resource);
                const el = await this.generateEntryFromResource(parent_resource);
                if (!el) return;
                return new Promise(resolve=>{
					parent_dom.after(el);
                    parent_dom.remove();
                    this.dom_tree.set(parent_resource, el);
					resolve()
                })
            })
        }

        // previous entry exists, update
        else if (dom) {
            await Semaphore.get(resource).execute(async ()=>{
                dom = this.dom_tree.get(resource);
                const el = await this.generateEntryFromResource(resource);
                if (!el) return;
                return new Promise(resolve=>{
					dom.after(el);
                    dom.remove();
                    this.dom_tree.set(resource, el);
					resolve();
                })
            });
           
        }

        
        //await this.updateFilter() // TODO use this.updateFilter()?
    }

    // update an entry in the DOM
    public async updateByIdentifier(identifier:string) {
        // get all tree entries for this pointer
        const promises = [] 
        for (let resource of this.resource_manager.getResourcesWithIdentifier(identifier)) {
            if (this.dom_tree.has(resource)) promises.push(this.updateEntry(resource)); // update if already in dom
        }
        await Promise.all(promises)
    }

    // delete an entry completely (also from DOM)
    public deleteByIdentifier(identifier:string) {
        // get all tree entries for this pointer
        for (let resource of this.resource_manager.getResourcesWithIdentifier(identifier)) {
            let dom = this.dom_tree.get(resource)
            if (dom) dom.remove(); // remove dom element
        }
    }

    // can be overriden
    protected isResourceAllowed(resource:Resource) {
        return true;
    }

    // add an entry in the DOM
    public async addEntry(resource:Resource) {
        if (this.dom_tree.has(resource)) {
            //logger.error("entry " + resource.path  + " already exists");
            return;
        }
        await this.treeElementRecursive(resource, this.dom_tree.get(resource.parent));
        await this.updateFilter()
    }

    public resetTree(){
        if (!this.tree_container) {
            this.tree_container = document.createElement("div");
            this.tree_container.classList.add('tree-container');
            if (this.options.display_root) this.tree_container.classList.add("display-root");
            this.outer_el = document.createElement("div");
            this.outer_el.style.whiteSpace = "nowrap"

            if (this.options.font) this.outer_el.style.font = this.options.font;

            if (this.options.line_type == 'dashed') this.tree_container.classList.add("dashed-lines")
            else if (this.options.line_type == 'solid') this.tree_container.classList.add("solid-lines")
            this.tree_container.append(this.outer_el);
            const scrollContainer = this.makeScrollContainer(this.tree_container);
            scrollContainer.style.paddingBottom = "20px";
            this.content.append(scrollContainer);
        }
        this.outer_el.innerHTML = "";
    }

    // update file tree DOM
    public async updateTree(){
        this.resetTree();
        await this.treeElementRecursive(this.root_resource, this.outer_el);
        //this.makeScrollContainer(this.outer_el)
    }

    // re-calculate filters starting from start_from resource
    protected async updateFilter(start_from:Resource = this.root_resource, parent_references = new Set<any>()){
        if (!start_from || !(start_from instanceof Resource)) return; // no valid start resource

        // reset temporary expanded entries before new search
        this.resetTemporaryExpandedEntries();

        // reset
        if (!this.search_value) {
            this.tree_container.querySelectorAll('.no-display').forEach(el=>el.classList.remove("no-display"))
            this.tree_container.querySelectorAll('.grey-out').forEach(el=>el.classList.remove("grey-out"))
            this.tree_container.querySelectorAll('.grey-out-children').forEach(el=>el.classList.remove("grey-out-children"))
        }
        // search
        else await this.updateEntryFilterDownFrom(start_from, parent_references);
    }


    // recursivly update all filters down from a specifc entry
    protected async updateEntryFilterDownFrom(resource:Resource, parent_references = new Set<any>()) {

        // recursive
        if (resource.meta.reference && parent_references?.has(resource.meta.reference)){
            logger.info("recursive structure in search");
            return;
        }
        // add reference to parents list
        parent_references.add(resource.meta.reference)

        // if not transparent_filter or is root resource
        if (!resource.meta.transparent_filter && resource.path_array.length !== 0) await this.updateEntryFilter(resource, parent_references);

        for (let child of await resource.children||[]){
            await this.updateEntryFilterDownFrom(child, new Set(parent_references));
        }
        
    }

    protected async updateEntryFilter(resource:Resource, parent_references?: Set<any>) {

        if (this.FILTER_PATH_DEPTHS == "ALL" || this.FILTER_PATH_DEPTHS.has(resource.path_array.length)) {
            let filter = this.onFilterEntry(resource);
            let dom = this.dom_tree.get(resource);

            // set css for dom element
            if (!filter) {
				dom?.classList.remove("grey-out-children", "grey-out");
				dom?.classList.add("no-display")
			}
            else if (filter=='grey') {
				dom?.classList.remove("grey-out-children", "no-display");
				dom?.classList.add("grey-out");
			}
            else if (filter===true) {
                dom?.classList.remove("grey-out-children");
				dom?.classList.remove("grey-out", "no-display");
                // show all children (also if invalid) if flag set 
                if (this.FILTER_SHOW_INVALID_CHILDREN) {
                    if (!this.options.expanded_paths.includes(resource.path)) await this.expand(resource, true, parent_references);
                    dom?.classList.add("grey-out-children");
                }

                // go through all parents up to root level, expand
                let i = 0;
                let parent = resource;
                while (parent = parent.parent) {
                    let parent_dom = this.dom_tree.get(parent);
                    // grey out if currently hidden, if visible keep visible
                    if (parent_dom?.classList.contains('no-display')) {
						parent_dom.classList.add("grey-out");
						parent_dom.classList.remove("no-display");
					}
                    // show all siblings if flag enabled, overrides no-display behaviour, not if FILTER_HIDE_INVALID_SIBLINGS_AT_ROOT_LEVEL and siblings are at root level
                    if (this.FILTER_SHOW_INVALID_SIBLINGS && i == 0 && !(this.FILTER_HIDE_INVALID_SIBLINGS_AT_ROOT_LEVEL && resource.path_array.length == 1))
                        parent_dom?.classList.add("grey-out-children")
                    // expand the parent
                    if (!this.options.expanded_paths.includes(parent.path)) await this.expand(parent, true, parent_references);
                    i--;
                } 
            }
            return filter;
        }
    }

    // generate a DOM Element from a resource
    protected async generateEntryFromResource(resource: Resource, parent_references = new Set([resource?.meta.reference, resource.parent?.meta.reference])): Promise<HTMLElement>{
        // is this resource allowed in the current tree configuration (otherwise completely ignore)
        // always allowed if root resource
        if (resource.path_array.length > 0 && !this.isResourceAllowed(resource)) return;

        let header:HTMLElement;

        let el_name = resource.meta.html ?? resource.name;
        if (!this.options.expanded_paths) this.options.expanded_paths = [];

        // add own reference


        let is_first = resource == this.root_resource; // is root resource?

        // is directory item
        if (resource.is_directory) {

            let dir_el_creator = HTMLUtils.createElementCreator(resource.path, async (path)=>{
                return await this.handleCreateElementFromResource(Resource.get(path))
            },async (path)=>{
                return this.handleCreateSeparateElementsFromEntry(Resource.get(path))
            },"multiple");

            let outer_el:HTMLElement;

            // is dir expanded? always force expand if is first dir (-> otherwise invisible)
            let expanded = this.options.expanded_paths.includes(resource.path) || is_first;

            // new dir element + append to parent
            // <span style="margin-right: 5px" class="fa fa-caret-right"></span>
            let collapsed_brace = resource.meta.braces ? `<span class='collapsed-brace'><span style="color:#aaa">…</span><span style='color:${this.text_color_highlight};margin-left:3px'>${resource.meta.braces[1]}</span></span>` : "";
            let start_brace = resource.meta.braces? `<span style='color:${this.text_color_highlight};margin-right:3px;'>${resource.meta.braces[0]}</span>`:"";
            header = HTMLUtils.createHTMLElement(`<div class="dir-header" style="color:${Utils.getResourceColor(resource)}"><div ${this.options.enable_entry_drag?'draggable="true"':''} tabindex="0" style="display:flex;align-items:baseline;${this.options.full_entry_width?"width:100%":""}">${Utils.getResourceIcon(resource)}<span class="entry-name" style="${this.options.full_entry_width?"width:100%":""}" spellcheck=false>${(el_name??"") + start_brace}${collapsed_brace}</span></div></div>`);
            outer_el = HTMLUtils.createHTMLElement(`<div class="tree-entry dir ${expanded ? "":"collapsed"} ${typeof el_name == "string" && el_name?.startsWith(".") ? "hidden":""} ${!await resource.children || resource.meta.linked ? "empty":""}"></div>`);

            if (await resource.children && !resource.meta.linked) {
                let header_caret = HTMLUtils.createHTMLElement(`<div class="dir-caret">${I`fa-caret-down`}</div>`)
                header.prepend(header_caret)
            }
            
            else if (resource.meta.linked) {
                header.addEventListener("click", ()=>{
                    // TODO
                })
            }
            else {
                
            }

            outer_el.append(header);

            // root element cannot be collapsed
            if (!(this.options.display_root && is_first)) {
                // open dir normally, collapse/expand only via caret
                if (resource.meta.open) {
                    if (this.options.enable_entry_open) HTMLUtils.addDelegatedEventListener(header, "click", "div:not(.dir-caret, .additional)", ()=>this.onEntryClick(resource))
                    HTMLUtils.addDelegatedEventListener(header, "click", ".dir-caret", ()=>this.toggleCollapse(resource))
                }
                // open/collapse when clicking on entry, or on caret
                else {
					HTMLUtils.addDelegatedEventListener(header, "click", "div:not(.additional)", () => this.toggleCollapse(resource))
                }
            }

            // Enter key press => toggle folder collapse
            let enter_free = true;
            HTMLUtils.addDelegatedEventListener(header, "keydown", "div", (e:KeyboardEvent)=>{
                if (enter_free && e.key=="Enter") this.toggleCollapse(resource)
                enter_free = false;
            })
            HTMLUtils.addEventListener(header, "keyup", (e:KeyboardEvent)=>{
                if (e.key=="Enter") enter_free = true;
            });

            // header.on("dblclick", "div", ()=>{
            //     this.handleEdit(el.path)
            // })

            // calculate filter
            await this.updateEntryFilter(resource, parent_references);


            header.querySelector("div").addEventListener("dragend", e=>{
                if (e.dataTransfer.dropEffect == "none") Sounds.play(Sounds.ERROR_2)
            });

            if (this.options.enable_entry_drag) Handlers.handleDrag(header.querySelector("div"), {
                [Types.DRAGGABLE.TREE_ITEM]: resource.path,
                [Types.DRAGGABLE.TEXT]: resource.path,
                [Types.DRAGGABLE.ELEMENT_CREATOR]: dir_el_creator
            })


            if (this.options.enable_entry_drop) Handlers.handleDrop(outer_el, {

                allowed_types: new Set([Types.DRAGGABLE.TREE_ITEM, Types.DRAGGABLE.EXTERNAL_FILE]),

                // auto expand on hover with file
                long_hover: ()=>{
                    if (this.dom_tree.get(resource).classList.contains("collapsed")) this.expand(resource, false, parent_references);
                },

                drop: async (drop_event)=>{  // drop event
                    this.onEntryDrop(resource, drop_event);
                    // if (drop_event.types.has(Types.DRAGGABLE.TREE_ITEM)) {
                    //     let entry = <tree_entry> drop_event.data[Types.DRAGGABLE.TREE_ITEM];
                    //     await FileHandler.moveFile(entry.path, el.path, this.tree)//.valid) this.collapse(el);
                    // }
                    //
                    // else if (drop_event.types.has(Types.DRAGGABLE.EXTERNAL_FILE)) {
                    //     loadExternalFiles(drop_event.data[Types.DRAGGABLE.EXTERNAL_FILE], (file_name, content)=> {
                    //         FileHandler.addFile(el.path + "/" + file_name, content)
                    //     });
                    // }
                }
            })

            Handlers.contextMenu(header, ...this.createEntryContextMenu(resource));


            let braces_element = (resource.meta.braces) ? HTMLUtils.createHTMLElement(`<div class="end-brace">${resource.meta.braces[1]}</div>`) : null;

            let expand_immediately = is_first || expanded;

            // expand handler for children
            this.expand_handlers.set(resource, async (parent_references?:Set<any>) => {

                if (!this.expand_handlers.has(resource)) return; // already expanded
                this.expand_handlers.delete(resource)

                // clear children/end-brace DOM (if already loaded in the meantime)?
                outer_el.querySelectorAll(":scope > .tree-entry, :scope > .end-brace").forEach(e => e.remove());

                // load children DOM
                for (let child of await resource.children) {
                    const el = await this.generateEntryFromResource(child, new Set([...parent_references??[], resource.meta.reference]));
                    if (!el) continue;
                    this.dom_tree.set(child, el);
                    outer_el.append(el)
                }
                              
                // now finally add end braces
                if (resource.meta.braces && braces_element) outer_el.append(braces_element)
            })
            
            // expand children directly
            if (expand_immediately) await this.expand(resource, false, parent_references);
        
            await this.updateFilter(resource, parent_references); // no calculate filters starting from the resource

            return outer_el;
        }

        // file item
        else {

            let file_el_creator = HTMLUtils.createElementCreator(resource.path, async (path)=>{
                return await this.handleCreateElementFromResource(Resource.get(path))
            })

            // has corresponding .ts file? TODO move
            if (typeof el_name == "string" && el_name?.endsWith(".ts") && [...await resource.parent.children].filter((r)=>r.name==(typeof el_name == "string" ? el_name.replace(".ts",".ts") : null)).length) {
                //logger.info("found corresponding ts file for " + resource.path);
                return;
            }

            //UIX.formatFileName(el_name)
            header = HTMLUtils.createHTMLElement(`<div class="tree-entry file ${typeof el_name == "string" && el_name?.startsWith(".") ? "hidden":""}" style="color:${Utils.getResourceColor(resource)}"><div ${this.options.enable_entry_drag?'draggable="true"':''} tabindex="0" style="display:flex;align-items:baseline">${Utils.getResourceIcon(resource)}<span class="entry-name" style="${this.options.full_entry_width?"width:100%":""}" spellcheck=false>${el_name??""}</span></div></div>`)

            if (this.options.enable_entry_open) {
				HTMLUtils.addDelegatedEventListener(header, "click", "div", ()=>this.onEntryClick(resource))
				HTMLUtils.addDelegatedEventListener(header, "keypress", "div", async (e:KeyboardEvent) => {
                    if (e.key=="Enter") {
                        let tab_group = this.collector ?? TabGroup.getLastActiveGroup();
                        if (tab_group) tab_group.addChild(await this.handleCreateElementFromResource(resource), {}, true);
                    }
                })
            }

            if (this.options.enable_entry_edit) {
                HTMLUtils.addDelegatedEventListener(header, "dblclick", "div", (e)=>{
                    this.handleEntryEdit(resource)
                    e.preventDefault();
                    e.stopPropagation();
                })
            } 

            if (this.options.enable_entry_drag) Handlers.handleDrag(header.querySelector("div"), {
                [Types.DRAGGABLE.TREE_ITEM]: resource.path,
                [Types.DRAGGABLE.TEXT]: resource.path,
                [Types.DRAGGABLE.ELEMENT_CREATOR]: file_el_creator
            })


            header.querySelector("div").addEventListener("dragend", e=>{
                if (e.dataTransfer.dropEffect == "none") Sounds.play(Sounds.ERROR_2)
            });

            Handlers.contextMenu(header.querySelector("div"), ...this.createEntryContextMenu(resource));

            await this.updateFilter(resource, parent_references); // no calculate filters starting from the resource

            return header;
        }
    }

    protected async treeElementRecursive(resource: Resource, parent_element?:HTMLElement) {

        if (!parent_element) parent_element = this.dom_tree.get(resource.parent);

        if (!parent_element) {
            logger.error("cannot find parent element for tree entry " + resource.default_path);
            return;
        }

        // generate entry and pass reference Set
        const el = await this.generateEntryFromResource(resource);
        if (!el) return;
        this.dom_tree.set(resource, el);

        // add to DOM
        parent_element.append(el);
    }


    /** can be re-implemented - return true if should be displayed, 2g if not highlighted, but still displayed */
    protected onFilterEntry(resource:Resource):boolean|'grey' {

        if (!this.search_value) return true; // don't filter anything
        
        // filter string search
        else if (resource.name.toLowerCase && resource.name.toLowerCase().indexOf(this.search_value.toLowerCase())!==-1) {
            return true;
        } 
        else if (resource.meta.filter_strings instanceof Array) {
            for (let f of resource.meta.filter_strings) {
                if (f.toLowerCase && this.search_value.toLowerCase && f.toLowerCase().indexOf(this.search_value.toLowerCase())!==-1) {
                    return true;
                } 
            }
            if (resource.path_array.length == 2) {
                return 'grey';
            } 
        }
    }


    /** can be overridden*/

    protected createEntryContextMenu(resource: Resource): [Types.context_menu, { title: string, info?: string, icon?: string, color?: string }]{
        return [
            this.createContextMenuBody(resource)||{},
            this.createContextMenuHeader(resource)
        ];
    }

    /** should be implemented */

    protected createContextMenuBody(resource: Resource): Types.context_menu {
        return {}
    }

    // can be overriden
    protected createContextMenuHeader(resource: Resource):Types.context_menu_header {
        return {
            title: resource.meta.html ? `<span style='font:${this.options.font??'inherit'}'>${(resource.meta.html + (resource.meta.braces?(resource.meta.braces[0]+" … "+resource.meta.braces[1]):""))}</span>` : resource.name,
            color: Utils.getResourceColor(resource),
            icon: Utils.getResourceIcon(resource),
            left: this.CONTEXT_MENU_HEADER_LEFT,
            info:""
        }
    }

    /**DEFAULT IMPLEMENTATION OPTIMIZED FOR FileTrees*/
    /** divides an entry into an array of single elements corresponding to the entries (files) */
    protected async handleCreateSeparateElementsFromEntry(resource: Resource):Promise<Base[]> {
        let children:Set<Resource> = await resource.children

        if (!children) {
            return [await Files.createFileElement(resource, {})];
        }
        else {
            let els = [];
            for (let child of children) {
                els.push(await Files.createFileElement(child, {}));
            }
            return els;
        }
    }

    /**DEFAULT IMPLEMENTATION OPTIMIZED FOR FileTrees*/
    protected async handleCreateElementFromResource(resource: Resource): Promise<Base> {

        const files = await this.handleCreateSeparateElementsFromEntry(resource);

        if (!await resource.children) return files[0];

        else {
            const group = new TabGroup({title:resource.name, title_color:Utils.getResourceColor(resource), icon:Utils.getResourceIcon(resource)});
            for (const file of files) group.addChild(file, {}, true);
            return group;
        }
    }

    protected not_allowed_entry_chars = ["/", "\\", "*", ";", "'", "\"", ":", "|", "`"]

    protected async handleEntryEdit(resource:Resource, open_after_edit = false) {

        let edit_field:HTMLElement = this.dom_tree.get(resource)?.querySelector(".entry-name");

        if (!edit_field) return;

        edit_field.setAttribute("contenteditable", "true");
        

        let selection = window.getSelection();
        let element = edit_field.querySelector("span") || edit_field;

        if (selection.rangeCount > 0) {
            selection.removeAllRanges();
        }

        let range = document.createRange();
        range.selectNode(element);
        selection.addRange(range);

        let click_listener = e => e.stopPropagation()

        let keydown_listener =  e => {
            if (this.not_allowed_entry_chars.includes(e.key)){
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            else if (e.key=="Enter") {
                e.preventDefault();
                e.stopPropagation();
                (async ()=>{
                    try {
                        console.log("rename", edit_field.innerText)
                        await resource.rename(edit_field.innerText)
                        end_edit()
                        edit_field.innerHTML = resource.name;
                    } catch (e) {
                        console.error(e)
                        this.shakeItem(resource);
                    }
                })()
            }
            e.stopPropagation();
        }

        let blur_listener = ()=>{
            end_edit()
            let el_name = resource.name
            //UIX.formatFileName(this.tree.getPathName(path))
            edit_field.innerHTML = el_name;
        }

        let end_edit = ()=>{
            edit_field.removeAttribute("contenteditable")
			HTMLUtils.removeEventListener(edit_field, "mousedown click", click_listener)
            edit_field.removeEventListener("keydown", keydown_listener)
            edit_field.removeEventListener('grey', blur_listener);
        }

		HTMLUtils.addEventListener(edit_field, "mousedown click", click_listener)
        edit_field.addEventListener("keydown", keydown_listener)
        edit_field.addEventListener('grey', blur_listener);

        edit_field.focus();
        edit_field.click();
    }

    /** uses handleCreateElementFromEntry per default - can be modified if necessary*/
    protected async onEntryClick(resource: Resource){
        const tab_group = this.collector ?? TabGroup.getLastActiveGroup();
        if (tab_group) tab_group.addChild(await this.handleCreateElementFromResource(resource), {}, true);
    }

    protected async onEntryDelete(resource:Resource) {}
    protected async onEntryDrop(resource:Resource, drop_event: {types: Set<Types.DRAGGABLE>, data: Types.draggable_data}) {}


    private shakeItem(resource:Resource) {
        let el = this.dom_tree.get(resource);
        if (el.classList.contains("dir")) el = el.querySelector(".dir-header");
        el.classList.add("shake")
        setTimeout(()=>el.classList.remove("shake"), 700);
    }


    public get search_value(){
        return this.options._search_value;
    }
    public set search_value(value:string){
        this.options._search_value = value;
    }

    // change resource
    public async setResource(resource_or_path:string|Resource) {

        this.root_resource = resource_or_path instanceof Resource ? resource_or_path : Resource.get(resource_or_path);
        this.options.root_resource_path = this.root_resource.path;
        this.resource_manager = this.root_resource.resource_manager

        // force reload resource (get new children, changed meta data?)
        await this.root_resource.reload()

        // load tree
        await this.updateTree();

        // TODO remove old listeners

        // change listeners for all child resources of the root resource
        this.root_resource.listenForNewResources((resource:Resource)=>{
            this.addEntry(resource);
        })

        this.root_resource.listenForUpdates((resource:Resource)=>{
            this.updateEntry(resource)
        })

        this.root_resource.listenForRename((resource:Resource)=>{
			const el = this.dom_tree.get(resource)?.querySelector(".entry-name");
			if (el) el.innerHTML = resource.name
        })

        this.root_resource.listenForRemove((resource:Resource)=>{
            let dom = this.dom_tree.get(resource)
            if (dom) dom.remove(); // remove dom element
        })
    }

    /* // TODO
    public override async createHeader(){

    }

    public override async createHeaderRightElements(){

    }*/

    public override async onCreate() {
        
        this.content.style.display = "flex";
        this.content.style.flexDirection = "column";

        if (this.options.header) {

            const searchValue = text(this.search_value);
            searchValue.observe(text=>{
                this.search_value = text;
                this.updateFilter();
            });


            let elements: Elements.Header.ElementData[] = [
                {text:this.title_dx},
                {element: new Elements.TextInput(searchValue, {placeholder:S('search')}), align:'end'}
            ]

            this.header = new Elements.Header(elements, {seperator:true, margin_bottom:true})

            this.header.style.width = "calc(100% - 20px)";
    
        }

        if (!this.root_resource) {
            if (!this.options.root_resource_path) {logger.warn("no root resource path provided for tree view", this);return}
            else this.root_resource = Resource.get(this.options.root_resource_path)
        }

        await this.setResource(this.root_resource)

    }

}


