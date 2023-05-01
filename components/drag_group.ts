import { Component, Group as UIXGroup, NoResources } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { I, S } from "../uix_short.ts";
import { Group } from "./group.ts";
import { Clipboard } from "../base/clipboard.ts";
import { Types } from "../utils/global_types.ts";
import { global_states, logger } from "../utils/global_values.ts";
import { SAFARI_COMPATIBILITY_MODE } from "../utils/constants.ts";


export namespace DragGroup {
    export interface Options extends Group.Options {
        zoomable?:boolean // can be scaled
        movable?:boolean // can container be moved?
        min_x?:number,
        max_x?:number,
        min_y?:number,
        max_y?:number,
        min_zoom?:number,
        max_zoom?:number,

        bg_pattern?:'checkers'|'grid'|'plus'|'polka',

        move_with_shift?:boolean // move container with shift pressed

        _translate_x?: number // position of the node_container inside the html div
        _translate_y?: number
        _zoom?: number// node container scale
    }
}

@UIXGroup("Groups")
@Component<DragGroup.Options>({
    sealed: false, 
    icon: 'fa-network-wired',
    enable_drop: true,
    bg_color: "transparent",
    movable: false,
    min_zoom: 0.5,
    max_zoom: 10,
    bg_pattern: 'grid'
})
@NoResources
export class DragGroup<O extends DragGroup.Options=DragGroup.Options, ChildElement extends Base = Base> extends Group<O, ChildElement> {
    declare public outer_container:HTMLDivElement;
    declare public bg_container:HTMLDivElement;
    declare public node_container:HTMLSlotElement;
    // declare public connection_container:HTMLDivElement;
    declare private select_box: HTMLDivElement

    #selected_elements = new Set<ChildElement>()

    get selected_elements() {
        return this.#selected_elements;
    }

    override onCreateLayout(){
        if (!('_translate_x' in this.options)) this.options._translate_x = 0; // position of the node_container inside the html div
        if (!('_translate_y' in this.options)) this.options._translate_y = 0;
        if (!('_zoom' in this.options)) this.options._zoom = 1; // node container scale
        
        // outer, transformable container for everything
        this.outer_container = document.createElement("div");
        this.outer_container.style.transformOrigin = "0px 0px";
        this.outer_container.style.transform = "translate(0px, 0px) scale(1)";
        this.outer_container.style.position = "relative";


        // child elements are added here
        this.bg_container = document.createElement("div");
        this.bg_container.style.position = "absolute";
        this.bg_container.style.display = "block";
        this.bg_container.style.width = "100%";
        this.bg_container.style.height = "100%";
        this.bg_container.style.zIndex = "0";
        this.outer_container.append(this.bg_container);

        // child elements are added here
        this.node_container = this.content;
        this.node_container.style.position = "absolute";
        this.node_container.style.display = "block";
        this.node_container.style.width = "100%";
        this.node_container.style.height = "100%";
        this.node_container.style.zIndex = "1";

        this.outer_container.append(this.node_container);

        // node connections are added here
        // this.connection_container = document.createElement("div");
        // this.connection_container.style.position = "absolute";
        // this.connection_container.style.display = "block";
        // this.connection_container.style.zIndex = "2";

        // this.outer_container.append(this.connection_container);



        // select box
        this.select_box = document.createElement("div");
        this.select_box.style.background = "#eeeeee11";
        this.select_box.style.border = "2px dashed var(--text_light)";
        this.select_box.style.display = "none";
        this.select_box.style.position = "absolute";
        this.select_box.style.zIndex = "1000";
        this.outer_container.append(this.select_box);

        this.content_container.append(this.outer_container);

        this.content.style.width = "100%";
        this.content.style.height = "100%";
        this.content.style.overflow = "visible";

        this.content_container.style.height = "100%";
        this.content_container.style.height = "100%";

        this.handleContainerChanges();

        this.outer_container.style.width = "100%";
        this.outer_container.style.height = "100%";


        if (this.options.bg_pattern == "checkers") {
            this.bg_container.style.backgroundImage = 'repeating-linear-gradient(45deg, rgba(148, 148, 148, 0.07) 25%, transparent 25%, transparent 75%, rgba(148, 148, 148, 0.07) 75%, rgba(148, 148, 148, 0.07)), repeating-linear-gradient(45deg, rgba(148, 148, 148, 0.07) 25%, rgba(229,229,247,0) 25%, rgba(229,229,247,0) 75%, rgba(148, 148, 148, 0.07) 75%, rgba(148, 148, 148, 0.07))';
            this.bg_container.style.backgroundSize =  '26px 26px';
            this.bg_container.style.backgroundPosition =  '0 0, 13px 13px';
        }

        else if (this.options.bg_pattern == "grid") {
            this.bg_container.style.backgroundImage = 'linear-gradient(rgba(100, 100, 100, .2) 1px, transparent 1px), linear-gradient(90deg, rgba(100, 100, 100, .2) 1px, transparent 1px)';
            this.bg_container.style.backgroundSize =  '1.5em 1.5em';
        }

        else if (this.options.bg_pattern == "polka") {
            this.bg_container.style.backgroundImage = 'radial-gradient(rgba(148, 148, 148, 0.14) 1px, rgba(229,229,247,0) 1px)';
            this.bg_container.style.backgroundSize =  '20px 20px';
        }

        this.focusable = true; // adds tabindex

        
    }

    protected override onAnchor() {
        // init right scale + position
        this.updateTransforms();
    }

    public override canResizeLeft(element:ChildElement){return 'w' in element.constraints}
    public override canResizeRight(element:ChildElement){return 'w' in element.constraints;}
    public override canResizeTop(element:ChildElement){return 'h' in element.constraints;}
    public override canResizeBottom(element:ChildElement){return 'h' in element.constraints;}


    private updateTransforms(){
        this.outer_container.style.transform = `translate(${this.options._translate_x}px, ${this.options._translate_y}px) scale(${this.options._zoom})`;
        this.handleBackgroundChunks();
    }


    protected override createContextMenu():Types.context_menu {
        return {
            paste: {
                text: S('paste'),
                icon: I('fas-paste'),
                shortcut: 'paste',
                handler: async (x,y)=>{
                    let el = await Clipboard.getItem(['application/datex-value']);
                    console.log("paste", el)
                    if (el instanceof Base) {
                        this.handleChildInsert(<ChildElement>el,x,y)
                    }
                }
            },
            select_all: {
                text: S('select_all'),
                shortcut: 'all',
                handler: ()=>{
                    this.selectAllElements();
                }
            },
            delete_selected: {
                text: S('delete_selected'),
                shortcut: 'delete',
                disabled: ()=>!this.#selected_elements.size,
                handler: ()=>{
                    this.removeSelectedElements();
                }
            },

        }
    }


    public selectAllElements(){
        for (let el of this.elements) this.selectElement(el)
    }

    public deselectAllElements(){
        for (let el of this.#selected_elements) el.style.outline = ""; // reset previous focused elements
        this.#selected_elements.clear();
    }

    public deselectElement(element:ChildElement){
        if (!this.#selected_elements.has(element)) return;
        this.#selected_elements.delete(element);
        element.style.outline = ""
    }

    public selectElement(element:ChildElement){
        if (this.#selected_elements.has(element)) return;
        this.#selected_elements.add(element);
        element.style.outline = "2px solid var(--text_highlight)"
        globalThis.active = element; // access in console as 'active' TODO if (UIX.DEBUG_MODE)
    }

    public removeSelectedElements(){
        for (let el of this.#selected_elements) el.remove();
    }

    public getSelectedElements(){
        return this.#selected_elements
    }

    public moveSelectedNodes(dx:number, dy:number){
        for (let el of this.#selected_elements) {
            el.constraints.x += dx;
            el.constraints.y += dy;
            this.onChildConstraintsChanged(el);
        }
    }

    #chunk_shift_x = 0;
    #chunk_shift_y = 0;
    #chunk_w = 1;
    #chunk_h = 1;

    private handleBackgroundChunks(){
        const box = this.bg_container.getBoundingClientRect();
        if (box.x > -400) {
            const chunks = Math.ceil(box.x/this.outer_container.offsetWidth/this.options._zoom)
            this.#chunk_shift_x += chunks;
            this.#chunk_w += chunks
        }
        if (box.y > -400) {
            const chunks = Math.ceil(box.y/this.outer_container.offsetHeight/this.options._zoom)
            this.#chunk_shift_y += chunks;
            this.#chunk_h += chunks;
        }

        if (box.x + box.width < this.outer_container.offsetWidth+400) {
            const chunks = Math.ceil((this.outer_container.offsetWidth-(box.x+box.width))/this.outer_container.offsetWidth/this.options._zoom)
            this.#chunk_w += chunks;
        }

        if (box.y + box.height < this.outer_container.offsetHeight+400) {
            const chunks = Math.ceil((this.outer_container.offsetHeight-(box.y+box.height))/this.outer_container.offsetHeight/this.options._zoom)
            this.#chunk_h += chunks;
        }

        this.bg_container.style.width = `${this.#chunk_w*100}%`
        this.bg_container.style.height = `${this.#chunk_h*100}%`

        const tx = -(this.#chunk_shift_x/this.#chunk_w)*100;
        const ty = -(this.#chunk_shift_y/this.#chunk_h)*100;

        this.bg_container.style.transform = `translate(${tx}%, ${ty}%)`
    }

    private updateSelectBoxSelection(x:number, y:number, w:number, h:number){
        for (let el of this.elements) {
            if (this.hasCollisionWithElementBox(el, x, y, w, h)) this.selectElement(el);
            else this.deselectElement(el);
        }
    }

    private handleContainerChanges(){
        let last_mouse_x:number, last_mouse_y:number;
        let moving = false;
        let moving_select_box = false;
        let select_box_start_client_x = 0,
            select_box_start_client_y = 0,
            select_box_start_x = 0,
            select_box_start_y = 0,
            last_x = 0,
            last_y = 0,
            d = 0;
            

        const SCALE_CHANGE = 1.02; // factor by which the scale changes

        if (this.options.zoomable) {
            this.content_container.addEventListener('wheel', (e:WheelEvent) => {    
                let bounds = this.content_container.getBoundingClientRect()
                let x = (e.clientX - bounds.x)
                let y = (e.clientY - bounds.y)
    
                let xs = (x - this.options._translate_x) / this.options._zoom,
                    ys = (y - this.options._translate_y) / this.options._zoom,
                    delta = -e.deltaY;
            
                (delta > 0) ? (this.options._zoom *= SCALE_CHANGE) : (this.options._zoom /= SCALE_CHANGE);
    
                if (this.options._zoom > this.options.max_zoom) this.options._zoom = this.options.max_zoom;
                if (this.options._zoom < this.options.min_zoom) this.options._zoom = this.options.min_zoom;
    
                this.options._translate_x = (x - xs * this.options._zoom)
                this.options._translate_y = (y - ys * this.options._zoom)
            
                this.updateTransforms()
            }, {passive:true});
        }

        if (this.options.movable) {

            const handle_move = (e:Event) => {
                if (!moving) return;

                if (e.touches?.length > 1) {
                    // TODO
                    console.log("zoom touch")
                    return;
                }

                const clientX = e.clientX ?? e.touches?.[0].clientX;
                const clientY = e.clientY ?? e.touches?.[0].clientY;
                
                // change select box size
                if (moving_select_box) {
                    const w = (clientX-select_box_start_client_x)/this.options._zoom;
                    const h = (clientY-select_box_start_client_y)/this.options._zoom;
                    // move into negative
                    if (w < 0) this.select_box.style.left = (select_box_start_x+w) + "px";
                    if (h < 0) this.select_box.style.top = (select_box_start_y+h) + "px";
                    // update height
                    this.select_box.style.width = Math.abs(w) + "px"
                    this.select_box.style.height = Math.abs(h) + "px"

                    // update selection when a certain distance is reached
                    d = (last_x-clientX)**2 + (last_y-clientY)**2;
                    if (d > 40) {
                        this.updateSelectBoxSelection(w < 0 ? select_box_start_x+w : select_box_start_x , h < 0 ? select_box_start_y+h : select_box_start_y, Math.abs(w), Math.abs(h));
                        last_x = clientX;
                        last_y = clientY;
                    }
                }

                // move complete container
                else {
                    const d_x = clientX - last_mouse_x;
                    const d_y = clientY - last_mouse_y;
                    last_mouse_x = clientX;
                    last_mouse_y = clientY;

                    this.options._translate_x += d_x;
                    this.options._translate_y += d_y;
                    this.updateTransforms()
                }

                e.stopImmediatePropagation();
                e.stopPropagation();
            }

     

            this.content_container.addEventListener("touchstart", e => {
                moving = true;
                last_mouse_x = e.touches[0].clientX;
                last_mouse_y = e.touches[0].clientY;
        
                window.addEventListener("touchmove", handle_move, true);

                this.onContainerClicked()

                e.stopImmediatePropagation();
            })

            this.content_container.addEventListener("mousedown", e => {
                if (e.button == 2) {
                    e.stopPropagation();
                    return; // contextmenu mousedown
                }
                if (!e.shiftKey) this.deselectAllElements();

                // select box
                if ((e.shiftKey && !this.options.move_with_shift) || (!e.shiftKey && this.options.move_with_shift)) {
                    moving_select_box = true;
                    select_box_start_client_x = e.clientX;
                    select_box_start_client_y = e.clientY;
                    this.select_box.style.display = "block";
                    const {x,y} = this.globalPositionToLocalPosition(e.clientX, e.clientY);
                    select_box_start_x = x;
                    select_box_start_y = y;
                    this.select_box.style.left = x + "px";
                    this.select_box.style.top = y + "px";
                    this.select_box.style.width = "0px";
                    this.select_box.style.height = "0px";
                }
                else {
                    this.content_container.style.cursor = "grabbing";
                    this.select_box.style.display = "none";
                } 
                
                moving = true;
                last_mouse_x = e.clientX;
                last_mouse_y = e.clientY;
        
                // handle move event in window and also stop propagation from html_element
                //window.addEventListener("mousemove", handle_move);
                window.addEventListener("mousemove", handle_move, true);

                this.onContainerClicked()

                e.stopImmediatePropagation();
            })

            // mouse move cleanup
            window.addEventListener("mouseup", e => {
                if (moving) {
                    window.removeEventListener("mousemove", handle_move, true)
                    this.content_container.style.cursor = "default";
                    moving = false;
                    moving_select_box = false;
                    this.select_box.style.display = "none";
                    e.stopPropagation();
                }
              
            })

            // touch move cleanup
            window.addEventListener("touchend", e => {
                if (moving) {
                    window.removeEventListener("touchmove", handle_move, true)
                    this.content_container.style.cursor = "default";
                    moving = false;
                    moving_select_box = false;
                    this.select_box.style.display = "none";
                    e.stopPropagation();
                }
            })

        }
 
    }


    public override handleChildInsert(element:ChildElement, x:number, y:number) {

        const {x:localX, y:localY} = this.globalPositionToLocalPosition(x, y);
        element.constraints.x = localX;
        element.constraints.y = localY;

        this.addChild(element);
    }

    // get container-local x and y from client x,y for nodes inside node_container
    protected globalPositionToLocalPosition(clientX:number, clientY:number){
        let bounds = this.content_container.getBoundingClientRect()
        let x = clientX - bounds.x;
        let y = clientY - bounds.y;

        x -= this.options._translate_x
        y -= this.options._translate_y;

        x /= this.options._zoom;
        y /= this.options._zoom;

        return {x:x, y:y};
    }
    
    // return container-global x and y
    protected getMousePositionInContainer(clientX:number, clientY:number){
        let bounds = this.content_container.getBoundingClientRect()
        let x = clientX - bounds.x;
        let y = clientY - bounds.y;

        x -= this.options._translate_x
        y -= this.options._translate_y;

        x /= this.options._zoom;
        y /= this.options._zoom;

        return {x:x, y:y};
    }


    // returns the element if a collision exists
    public getContainedElements(parent:ChildElement):Set<ChildElement> {
        const els = new Set<ChildElement>();

        for (const el of this.elements) {
            if (el !== parent && this.isIncludedInElementBox(parent, el)) els.add(el);
        }
        return els;
    }

    // returns the element if a collision exists
    public getParentElements(element:ChildElement):ChildElement[] {
        const els:ChildElement[] = [];
        for (const potentialParent of this.elements) {
            if (potentialParent !== element && this.isIncludedInElementBox(potentialParent, element)) els.push(potentialParent);
        }
        return els;
    }

    // child element collision detection
    public hasElementCollision(element: ChildElement) {
        return this.hasCollision(element.constraints.x??-1, element.constraints.y??-1, this.getChildWidth(element), this.getChildHeight(element), element)
    }

    // returns the element if a collision exists
    public hasCollision(x:number, y:number, w?:number, h?:number, exclude_element?:ChildElement):ChildElement|undefined {
        for (const el of this.elements) {
            if (el !== exclude_element && this.hasCollisionWithElementBox(el, x, y, w, h)) {
                return el;
            }
        }
    }

    public hasCollisionWithElementBox(el:ChildElement, x:number, y:number, w?:number, h?:number):boolean {
        const x2 = el.constraints.x ?? -1,
            y2 = el.constraints.y ?? -1,
            w2 = this.getChildWidth(el),
            h2 = this.getChildHeight(el);

        // point collision
        if (w == null || h == null) return (x>x2 && y>y2 && x<x2+w2 && y<y2+h2)
        // box collision
        else return (x<x2+w2 && x+w>x2 && y<y2+h2 && y+h>y2)
    }

    public isIncludedInElementBox(outer:ChildElement, test:ChildElement):boolean
    public isIncludedInElementBox(outer:ChildElement, x:number, y:number, w?:number, h?:number):boolean
    public isIncludedInElementBox(outer:ChildElement, x:number|ChildElement, y?:number, w?:number, h?:number):boolean {
        if (typeof x != "number") {
            const el = x;
            x = el.constraints.x ?? -1,
            y = el.constraints.y ?? -1,
            w = this.getChildWidth(el),
            h = this.getChildHeight(el);
        }
        const x2 = outer.constraints.x ?? -1,
            y2 = outer.constraints.y ?? -1,
            w2 = this.getChildWidth(outer),
            h2 = this.getChildHeight(outer);

        // point included
        if (w == null || h == null) return (x>x2 && y>y2 && x<x2+w2 && y<y2+h2)
        // box included
        else return (x+w<x2+w2 && x>x2 && y+h<y2+h2 && y>y2)
    }

    public putInFront(element:ChildElement){
        //for (let el of this.elements) el.style.zIndex = "0";
        //element.style.zIndex = "2";
    }


    override handleChildResize(element:ChildElement, dx, dy, movement_type) {

        dx /= this.options._zoom;
        dy /= this.options._zoom;

        let is_right = (movement_type==Types.AREA.RIGHT || movement_type==Types.AREA.TOP_RIGHT || movement_type==Types.AREA.BOTTOM_RIGHT);
        let is_left = (movement_type==Types.AREA.LEFT || movement_type==Types.AREA.BOTTOM_LEFT || movement_type==Types.AREA.TOP_LEFT);
        let is_top = (movement_type==Types.AREA.TOP || movement_type==Types.AREA.TOP_RIGHT || movement_type==Types.AREA.TOP_LEFT);
        let is_bottom = (movement_type==Types.AREA.BOTTOM || movement_type==Types.AREA.BOTTOM_RIGHT || movement_type==Types.AREA.BOTTOM_LEFT);

        // too small
        if (Number(element.style.width) < 50 && ((dx<0&&is_right) || (dx>0&&is_left))) return;
        if (Number(element.style.height) < 50 && ((dy<0&&is_bottom) || (dy>0&&is_top))) return;

        if (is_right)
            element.constraints.w += dx;
        if (is_bottom)   
            element.constraints.h += dy;
        if (is_left) {
            element.constraints.w -= dx;
            element.constraints.x += dx;
        }
        if (is_top) {
            element.constraints.h -= dy;
            element.constraints.y += dy;
        }
    
        this.onChildConstraintsChanged(element);
    }


    // TODO dont' to everything every time
    public override adjustChildLayout(element: ChildElement) {
        element.style.position = "absolute";
        element.style.pointerEvents = "auto";

        //element.style.willChange = "left, top" // "left, top"; // 'transform' to prevent artefacts in SaFarI? (renders blurred element instead)
        element.focusable = true // TODO reset this stuff when child removed

        element.addEventListener("focus", ()=>{
            if (!global_states.shift_pressed && !this.#selected_elements.has(element)) this.deselectAllElements();
            this.selectElement(element);
        })

        this.updateChildLayout(element);

        element.updateSize = false;

        if (element.constraints.x==null || element.constraints.y==null) this.autoPosition(element);

    }

    public updateChildLayout(element: ChildElement) {
        this.updateChildX(element);
        this.updateChildY(element);
        this.updateChildW(element);
        this.updateChildH(element);
        this.updateChildZ(element);
    }

    public updateChildX(element: ChildElement) {
        element.style.left = element.constraints.x!=undefined?element.constraints.x+"px" :"auto"
    }
    public updateChildY(element: ChildElement) {
        element.style.top = element.constraints.y!=undefined?element.constraints.y+"px" :"auto"
    }
    public updateChildW(element: ChildElement) {
        element.style.width = element.constraints.w!=undefined?element.constraints.w+"px" :"max-content"
        // to prevent safari rendering bug:
        if (SAFARI_COMPATIBILITY_MODE) {
            if (element.constraints.w==undefined) element.content_container.style.width = '';
            else element.content_container.style.width = '100%';
        }
    }
    public updateChildH(element: ChildElement) {
        element.style.height = element.constraints.h!=undefined?element.constraints.h+"px" :"max-content"
        // to prevent safari rendering bug:
        if (SAFARI_COMPATIBILITY_MODE) {
            if (element.constraints.h==undefined) element.content_container.style.height = '';
            else element.content_container.style.height = '100%';
        }
    }

    protected updateChildZ(element:ChildElement){
        element.style.zIndex = ((element.constraints.zlayer??0) * 1000 + (element.constraints.z??0)).toString()
    }

    public getChildWidth(element: ChildElement){
        return element.constraints.w ?? element.width;
    }

    public getChildHeight(element: ChildElement){
        return element.constraints.h ?? element.height;
    }

    override onNewElement(element: ChildElement) {
        // element dimensions changed
        element.observeConstraint("w", () => this.updateChildW(element));
        element.observeConstraint("h", () => this.updateChildH(element));
        element.observeConstraint("x", () => this.updateChildX(element));
        element.observeConstraint("y", () => this.updateChildY(element));
        element.observeConstraint("z", () => this.updateChildZ(element));
        element.observeConstraint("zlayer", () => this.updateChildZ(element));

        this.setElementDraggable(element);
    }
    
    // autmatically position an element where there is free space
    autoPosition(element: ChildElement) {
        let collision_el:ChildElement;
        element.constraints.x = 10;
        element.constraints.y = 10;

        let i = 0;
        let row = 0;
        while ((collision_el = this.hasElementCollision(element))) {
            if (row > 1) {
                element.constraints.y = collision_el.constraints.y+this.getChildHeight(collision_el) + 10;
                element.constraints.x = 10;
                row = 0;
            }
            else element.constraints.x = collision_el.constraints.x+this.getChildWidth(collision_el) + 10;

            if (i++>1000) {
                logger.error("to many elements for auto positioning")
                break;
            }
            row++;
        }
    }


    protected setElementDraggable(element: ChildElement) {
        if (element.constraints.draggable) element.style.cursor = 'grab'
        else element.style.zIndex = "-1";

        let last_mouse_x:number, last_mouse_y:number;
        let moving = false;

        const handleMouseDown = (e:Event) => {
            if (e.button == 2) return; // contextmenu mousedown

            const clientX = e.clientX ?? e.touches?.[0].clientX;
            const clientY = e.clientY ?? e.touches?.[0].clientY;

            if (element.constraints.draggable == false) {
                element.style.cursor = ''
                element.style.zIndex = "-1";
                return; // currently not draggable
            }

            element.style.cursor = 'grabbing'
            this.putInFront(element);

            moving = true;
            last_mouse_x = clientX;
            last_mouse_y = clientY;

            const handle_move = (e:Event) => {
                if (!moving) return;

                const clientX = e.clientX ?? e.touches?.[0].clientX;
                const clientY = e.clientY ?? e.touches?.[0].clientY;

                const d_x = clientX - last_mouse_x;
                const d_y = clientY - last_mouse_y;
                last_mouse_x = clientX;
                last_mouse_y = clientY;

                this.moveSelectedNodes((d_x/this.options._zoom)??0, (d_y/this.options._zoom)??0)

                e.stopPropagation();
            }

            window.addEventListener("touchmove", handle_move);
            window.addEventListener("mousemove", handle_move);

            window.addEventListener("mouseup", (e)=>{
                window.removeEventListener("mousemove", handle_move);
                window.removeEventListener("touchmove", handle_move);
                element.style.cursor = 'grab'
            });
            window.addEventListener("touchend", (e)=>{
                window.removeEventListener("mousemove", handle_move);
                window.removeEventListener("touchmove", handle_move);
                element.style.cursor = 'grab'
            });

            e.stopPropagation();
        }

        element.addEventListener("mousedown", handleMouseDown)
        element.addEventListener("touchstart", handleMouseDown)

    }

    // implement -> called when element size or position changed
    public onChildConstraintsChanged(element:Base) {

    }

    // outer container mousedown event
    public onContainerClicked(){

    }


}

