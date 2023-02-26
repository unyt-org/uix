import { property, constructor, replicator, serialize } from "unyt_core/datex_all.ts";
import { Component, NoResources, Abstract } from "../base/decorators.ts";
import { Types } from "../utils/global_types.ts"
import { Base } from "./base.ts";
import { logger } from "../utils/global_values.ts"
import { Actions } from "../base/actions.ts"
import { S } from "../uix_short.ts"
import { Sounds } from "../base/sounds.ts";
import { Clipboard } from "../base/clipboard.ts";
import { ComponentSettings } from "./component_settings.ts";
import { Utils } from "../base/utils.ts"
import {Routing} from "../base/routing.ts";

export namespace Group {
    export interface Options extends Base.Options {
        name?: string,
        sealed?: boolean,

        temporary_children?: boolean, // don't save children state
    }
}

/**
 * Base class for element groups
 */
@Component({
    vertical_align: undefined,
    horizontal_align: undefined,
    padding: 0,
    fill_content:false
}) 
@NoResources
@Abstract
export abstract class Group<O extends Group.Options = any, ChildElement extends Base = Base> extends Base<O> {


    @property @serialize((value,self:Group)=>self.options.temporary_children?[]:value)
    public elements:ChildElement[] = [];  // array containing all child elements

    protected active_element?: ChildElement; // currently visible tab

    //@property @serialize((value,self:ComponentGroup)=>self.options.temporary_children?[]:value) // TODO!! serializer
    public element_constraints: Types.component_constraints[] = []

    public initialized_elements:Set<ChildElement> = new Set();  // Set containing all initialized child elements
    public anchored_elements:Set<ChildElement> = new Set();  // Set containing all fully loaded elements (after anchor)

    protected elements_by_id: Map<string, ChildElement> = new Map();

    protected slot_element:HTMLSlotElement = document.createElement("slot"); // has to be addded to DOM
    
    protected focus_next?: HTMLElement

    public current_max_index = 0;

    protected override default_context_menu:Types.context_menu = {
        element_settings: {
            text: S`element_settings`,
            handler: ()=>{
                let settings = new ComponentSettings({component_name:this.constructor.name});
                settings.setReferencedElement(this);
                Actions.elementDialog(settings);
            }
        },
        show_fullscreen: {
            text: S`show_fullscreen`,
            icon: 'fas-expand',
            // shortcut: 'toggle_fullscreen',
            handler: ()=>{
                Actions.goFullscreen(this, false)
            },
        },
        new_window: {
            text: S`new_window`,
            icon: 'fas-window-maximize',
            handler: ()=>{
                Actions.openElementInNewWindow(this)
            }
        },
        remove_component: {
            text: S`remove_component`,
            handler: ()=>{
                this.remove()
            }
        },
        copy_component: {
            text: S`copy_component`,
            handler: ()=>{Clipboard.putDatexValue(this)}
        },
        add_component: {
            text: S`add_component`,
            sub_menu: Utils.getElementAddItems(this)
        }
    }


    // public override get stored_datex_state(){
    //     if (this.options.temporary_children) return {options:this.options, elements:[], element_constraints:[]}
    //     else return {options:this.options, elements:this.elements, element_constraints:this.element_constraints}
    // }

    constructor(options?:Datex.DatexObjectInit<O>, constraints?:Datex.DatexObjectInit<Types.component_constraints>, elements?:ChildElement[]){
        super(options, constraints)
    }

    @constructor override construct(options?:Datex.DatexObjectInit<O>, constraints?:Datex.DatexObjectInit<Types.component_constraints>, elements?:ChildElement[]) {
        if (elements) {
            for (let el of elements) this.elements.push(el);
        }
        super.construct(options, constraints);

        // load initial children
        this.onBeforeChildren();
        this.loadAllElements(); 

        // assemble children
        this._handleAssemble()
    }

    @replicator override replicate() {
        super.replicate();

        // load initial children
        this.onBeforeChildren();
        this.loadAllElements();

        // assemble new if children are temporary
        if (this.options.temporary_children) this._handleAssemble()
        else {
            this.onReady();
        }
    }

    protected async _handleAssemble(){
        await this.onAssemble();
        await this.onReady(); // call on ready after everything is assembled
    }

    // default route implementation for Group components, resolve children by id
    override onRoute(identifier:string) {
        for (const child of this.elements) {
            if (child.identifier == identifier) return child;
        }
    }

    // return the current route of the group
    override getCurrentRoute() {
        if (!this.active_element) return [];
        return [this.active_element.identifier, ...this.active_element.getCurrentRoute()]
    }

    handleChildElementFocused(element:ChildElement) {
        this.active_element = element;
        this.onChildElementFocused(element);
        if (this.options.enable_routes) Routing.update(); // updates current url after child change
    }

    // can be implemented
    protected onChildElementFocused(element:ChildElement) {}


    // completely remove element
    removeElement(element:ChildElement) {
        if (!element) return false;
        const index = this.elements.indexOf(element);
        this.elements.splice(index, 1);
        this.element_constraints.splice(index, 1);
        this.elements_by_id.delete(element.identifier);
        this.disableFlagBubbling(element);
        element.removeNode(); // actually remove element from dom and trigger onRemove
        if (this.elements.length == 0) this.handleHasNoChildElements();
    }

    public loadAllElements(){
        for (let e=0; e<this.elements.length; e++) {;
            const element = this.elements[e];
            if (!element) continue;
            // connect element constraints
            //if (this.element_constraints[e]) element.constraints = this.element_constraints[e];
            //else 
            this.element_constraints[e] = element.constraints;
            this.addChild(element)
        } 
    }

    /**
     * Add (anchor) a child element
     * @param element new child element or child element class
     * @param custom_options child element options
     * @param put_in_focus call focus() method on child element (normally triggers onChildElementFocused method in parent), as soon as the child anchoring / setup is completed
     */
    public addChild<T>(element:Types.ComponentSubClass, custom_options?:T, put_in_focus?:boolean):boolean
    public addChild<O>(element:Base<O>, _?, put_in_focus?:boolean):boolean
    public addChild<O>(element:Base<O>|Types.ComponentSubClass, custom_options?:any, put_in_focus = false):boolean {

        if (!element) {
            logger.error("element does not exist");
            return false;
        }

        // is class
        if (typeof element === 'function') {
            element = new (<any>element)({
                margin: 0,
                ...(custom_options ?? {})
            });
        }

        const child = <ChildElement>element; // type cast

        // already add to elements before adding to DOM
        this.handleNewElement(child);
        this.adjustChildLayout(child);
        
        // add to DOM
        child.anchor(this);
        
        if (put_in_focus) this.focus_next = child;

        return true;
    }

    // initialize child element
    public handleNewElement(element:ChildElement) {
        // already handled
        if (this.initialized_elements.has(element)) return;
        this.initialized_elements.add(element);

        // add to elements array if not already there (existing element, from reconstructed DATEX object)
        if (!this.elements.includes(element)){
            this.elements.push(element);
            this.element_constraints.push(element.constraints);
        }
        
        // set uid + id map, update on change
        if (element.identifier != undefined) this.elements_by_id.set(element.identifier, element);

        this.handleHasChildElements();
        this.enableFlagBubbling(element);

        // bind element to parent (this) for inter-element messages
        this.bind(element);
    }


    // set custom constraints for child
    public handleChildInsert(element:ChildElement, x:number, y:number) {
        this.appendChild(element);
    }


    // can be overriden (default: always show all childs)
    public showChildIfActive(element: ChildElement){
        element.style.display = "flex";
    }

    // @implement child is on top edge of parent, let header behave as if child was actual root element
    public isChildPseudoRootElement(element: ChildElement){
        return false;
    }


    override generateSkeletonChildren(){
        const children_skeletons = [];
        for (const c of this.elements) children_skeletons.push(c.getSkeleton())
        return children_skeletons;
    }


    public enableEditProtectors(){
        for (const el of this.elements) {
            if (el.edit_protector) el.edit_protector.style.display = "block";
        }
    }

    public disableEditProtectors(){
        for (const el of this.elements) {
            if (el.edit_protector) el.edit_protector.style.display = "none";
        }
    }

    /** handle flag bubbling */

    private element_flag_listeners = new WeakMap<Base, Function[]>();

    protected enableFlagBubbling(element: Base) {
        const listeners = [];

        for (const flag_name of element.flags) {
            this.addFlag(flag_name)
        }

        listeners.push(element.onFlagAdded((flag_name)=>{
            this.addFlag(flag_name)
        }))

        listeners.push(element.onFlagRemoved((flag_name)=>{
            for (let e of this.elements){
                if (e.flags.has(flag_name)) return;
            }
            this.removeFlag(flag_name)
        }))
        this.element_flag_listeners.set(element, listeners)
    }

    protected disableFlagBubbling(element: Base) {
        // remove flags if not used by other child elements
        for (let to_be_removed_flag_name of element.flags) {
            let still_used = false;
            for (let e of this.elements){
                if (e.flags.has(to_be_removed_flag_name)) {
                    still_used = true
                    break;
                }
            }
            if (!still_used) this.removeFlag(to_be_removed_flag_name)
        }
        // remove flag listeners
        for (let listener of this.element_flag_listeners.get(element)??[]) {
            element.removeFlagListener(listener)
        }
    }


    /** called when children elements should be added (only called once, not after loading saved state)*/
    protected onAssemble() {
        // calls generateChildren per default
        let children = this.generateChildren();
        if (children) {
            for (let child of children) {if (child) this.addChild(child);} 
        }
    }

    // @implement
    protected generateChildren():ChildElement[]|void{}

    /** called immediately before the children are loaded (from JSON state or new)
     * */
    protected onBeforeChildren() {}

    /** called when all children are loaded (also if loaded from saved JSON state)
     * - now you have access to the children
     * */
    protected onReady() {}



    // implement; called when a new element is added and has at least on child element
    protected handleHasChildElements() {}
    // implement; called when has no elements
    protected handleHasNoChildElements() {}

    public replaceElement(index:number, with_index:number)
    public replaceElement(index:number, with_movable:ChildElement)
    public replaceElement(movable:ChildElement, with_index:number)
    public replaceElement(movable:ChildElement, with_movable:ChildElement)
    public replaceElement(index:number|ChildElement, with_index:number|ChildElement)
    public replaceElement(index:number|ChildElement, with_index:number|ChildElement): number {

        Sounds.play(Sounds.DROP)

        let element = index instanceof Base ? index : this.elements[index];
        let with_element = with_index instanceof Base ? with_index : this.elements[with_index];
        if (!with_element || !element) return -1;

        const new_index = this.elements.indexOf(element);

        this.removeElement(element)
        this.addChild(with_element);
        // with_element.constraints = this.element_constraints[new_index]; // TODO copy constraints

        return new_index;
    }

    /**
     * returns a Element with a identifier if it is a child element of the tab group
     */
    public getElementByIdentifier(id:string): ChildElement {
        return this.elements_by_id.get(id);
    }

    /**
     * returns the tab index of a moveable with a identifier if it is a child element of the tab group
     */
    protected getElementIndexById(id:string): number {
        return this.elements.indexOf(this.getElementByIdentifier(id));
    }

    // ComponentGroup methods than can be implemented:
    
    // @implement
    // after a element was removed from the parent
    protected onElementUnlinked(element:ChildElement){}

    // when child onConnected called
    public async handleChildAnchor(element:ChildElement) {
        if (!this.elements.includes(element)) throw new Error("Cannot handle anchor of non-child element")
        
        if (this.anchored_elements.has(element)) return;
        else this.anchored_elements.add(element);

        await this.onNewElement(element);

        // handle child focus (requested on addChild method, handled after child anchor completed)
        if (this.focus_next == element) {
            element.focus();
            this.focus_next = undefined;
        }
    }

    protected override handleHide(): void {
        super.handleHide();
        for (let el of this.elements) {
            if (!el.is_hidden) el.triggerHideEvent();
        }
    }

    protected override handleShow(): void {
        super.handleShow();
        for (let el of this.elements) {
            if (!el.is_hidden) el.triggerShowEvent();
        }
    }

    // @implement called when new child element was added and fully created
    public onNewElement(element:ChildElement){
        // element.focus(); // assume focused by default, can be overridden
    }

    // @implement
    // change element properties (position, ...) to match parent
    public adjustChildLayout(element:ChildElement){}

    // @implement
    // called when child position or size changed
    public handleChildResize(element:Base, dx:number, dy:number, movement_type:string): void {}

    // @override
    public canResizeLeft(element:ChildElement){return false;}
    public canResizeRight(element:ChildElement){return false;}
    public canResizeTop(element:ChildElement){return false;}
    public canResizeBottom(element:ChildElement){return false;}

}
