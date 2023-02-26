// deno-lint-ignore-file no-namespace
import { Group } from "./group.ts"
import { Component, NoResources, Group as UIXGroup } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { Handlers } from "../base/handlers.ts";
import { Types } from "../utils/global_types.ts";
import { Webpage } from "./webpage.ts";
import { I } from "../uix_short.ts";

export namespace GridGroup {
    export interface Options extends Group.Options {
        columns?:number[], 
        rows?:number[],
        auto_size?:boolean, // grid columns and rows are reponsivly created
        strict_size?:boolean, // force exact preferred column_width / row_height
        column_width?:number, // preferred column width when auto_size is on
        row_height?:number, // preferred row height when auto_size is on
        overflow_scroll?: boolean, // scroll grid on content overflow
        gaps?: number,
        animate_children?:boolean, // animate child elements on hover
        scroll_in_portrait?:boolean // allow scrolling down in portrait mode
        auto_position?:boolean // auto position children (only relevant if auto_size is false)
    }
}


@UIXGroup("Groups")
@Component<GridGroup.Options>({
    sealed:true, 
    icon: I('fa-layer-group'),
    columns: [1, 1],
    rows: [1, 1],
    column_width: 400,
    row_height: 300,
    auto_size: false,
    strict_size:false,
    overflow_scroll: true,
    gaps: 12,
    enable_drop: true,
    bg_color: "transparent",
    border: false,
    responsive: true,
})
@NoResources
export class GridGroup<O extends GridGroup.Options=GridGroup.Options, ChildElement extends Base = Base> extends Group<O, ChildElement> {
    
    // create custom grid layout
    protected override onCreateLayout() {
        
        this.updateGrid(); // set grid area templates

        this.style.pointerEvents = 'none';

        this.slot_element.style.display = "grid";
        this.slot_element.style.width = "100%";
        this.slot_element.style.height = "100%";
        this.slot_element.style.gridAutoFlow = "dense";
        this.slot_element.style.overflow = "visible";

        // grid gaps
        if (this.options.gaps) {
            this.slot_element.style.columnGap = this.options.gaps + "px";
            this.slot_element.style.rowGap = this.options.gaps + "px";
        }

        // enable height > 100%
        if (this.options.auto_size && this.options.overflow_scroll) {
            this.slot_element.style.minHeight = "100%"
            this.slot_element.style.height = "max-content"
            this.content_container.style.overflow = "scroll";
            this.style.pointerEvents = 'all';
        }
        else {
            this.slot_element.style.height = "100%"
        }

        this.content_container.append(this.slot_element);
    }
  
    // changed to normal mode
    protected override onLayoutModeNormal() {

        this.slot_element.style.display = "grid";

        // enable height > 100%
        if (this.options.auto_size && this.options.overflow_scroll) {
            this.slot_element.style.minHeight = "100%"
            this.slot_element.style.height = "max-content"
            this.content_container.style.overflow = "scroll";
        }
        else {
            this.slot_element.style.height = "100%"
            this.content_container.style.overflow = "visible";
        }

        // scrolling still required if overflow_scroll enabled
        if (!(this.options.auto_size && this.options.overflow_scroll)) this.content_container.style.pointerEvents = 'none';

        // update child elements
        for (let el of this.elements) this.adjustChildLayout(el)

        return true;
    }

    // changed to portrait mode
    protected override onLayoutModePortrait() {

        // is already a 1-column grid layout, ignore
        if (!this.options.auto_size && this.options.columns?.length<=1) return false;


        // scroll elements down, fill as much height is needed
        if (this.options.overflow_scroll) {
            this.slot_element.style.display = "block";
        }
        // fit all elements in 100% height 
        else {
            this.slot_element.style.display = "flex";
            this.slot_element.style.flexDirection = "column";
        }
        this.slot_element.style.height = "100%";
        this.content_container.style.overflow = "scroll";

        this.content_container.style.pointerEvents = 'all';

        // update child elements
        for (let el of this.elements) this.adjustChildLayout(el)

        return true;
    }

    private next_gx = 0;
    private next_gy = 0;

    // autmatically position element
    public override onNewElement(element: ChildElement): void {
        // no forced grid position -> auto position
        if (this.options.auto_position && !element.constraints?.hasOwnProperty('gx') && !element.constraints?.hasOwnProperty('gy')) {
            // overflow, start new row
            if (this.next_gx + element.gw > this.options.columns.length) {
                this.next_gx = 0;
                this.next_gy ++;
            }

            element.gx = this.next_gx;
            element.gy = this.next_gy;
            this.adjustChildLayout(element);
            this.next_gx += element.gw;
        }
        else {
            if (element.gy >= this.next_gy) this.next_gy = element.gy;
            if (element.gy == this.next_gy && element.gx >= this.next_gx) this.next_gx = element.gx + element.gw;
        }

    }


    override adjustChildLayout(element:ChildElement){
        element.style.position = "relative";

        if (this.options.animate_children) element.classList.add('animate-on-hover');

        // flex
        if (this.portrait_mode.val) {
            element.setSizeDynamic();

            // replace gap size with margin, if no flex gaps
            if (this.options.overflow_scroll) element.style.marginBottom = this.options.gaps + "px"; 
            
            //element.style.maxHeight = "100%"
            element.style.height = "max-content"
            element.style.minHeight = "0" // reset from grid
        }

        // grid
        else {

            element.style.marginBottom = "0px"; // reset
            element.style.maxHeight = "";
            element.setSizeFixed();


            if (element.constraints.dynamic_size) {
                element.style.height = "fit-content";
            }

            const gx = element.gx;
            const gy = element.gy;
            const gw = element.gw;
            const gh = element.gh;
    
            // update css grid position, else auto positioned
            if (!this.options.auto_size) {
                element.style.gridColumnStart = (gx+1).toString();
                element.style.gridColumnEnd = (gx+gw+1).toString();
                element.style.gridRowStart = (gy+1).toString();
                element.style.gridRowEnd = (gy+gh+1).toString();
            }

            // fixed height for overflow scrolling
            if (this.options.row_height && this.options.overflow_scroll && this.options.auto_size) element.style.minHeight = this.options.row_height + "px"
        }
    }

    override handleChildResize(element:Base, dx, dy, movement_type) {
    
        const gx = element.gx;
        const gy = element.gy;
        const gw = element.gw;
        const gh = element.gh;

        // right
        if (movement_type==Types.AREA.RIGHT)             this.moveGridLine([gx+gw, -1], [dx, 0], gw, gh, [1,-1]);
        else if (movement_type==Types.AREA.LEFT)         this.moveGridLine([gx, -1], [dx, 0], gw, gh, [0, -1]);
        else if (movement_type==Types.AREA.TOP)          this.moveGridLine([-1, gy], [0, dy], gw, gh, [-1, 0]);
        else if (movement_type==Types.AREA.BOTTOM)       this.moveGridLine([-1, gy+gh], [0, dy], gw, gh, [-1, 1]);

        else if (movement_type==Types.AREA.BOTTOM_LEFT)  this.moveGridLine([gx, gy+gh], [dx, dy], gw, gh, [0, 1]);
        else if (movement_type==Types.AREA.BOTTOM_RIGHT) this.moveGridLine([gx+gw, gy+gh], [dx, dy], gw, gh, [1, 1]);
        else if (movement_type==Types.AREA.TOP_LEFT)     this.moveGridLine([gx, gy], [dx, dy], gw, gh, [0, 0]);
        else if (movement_type==Types.AREA.TOP_RIGHT)    this.moveGridLine([gx+gw, gy], [dx, dy], gw, gh, [1, 0]);
    }


    // @implement child is on top edge of parent, let header behave as if child was actual root element
    public override isChildPseudoRootElement(element: ChildElement){
        return this.is_root_element && element.constraints.gy == 0;
    }

    public override canResizeLeft(element:ChildElement){return element.gx != 0;}
    public override canResizeRight(element:ChildElement){return (element.gx+element.gw) != this.options.columns?.length;}
    public override canResizeTop(element:ChildElement){return element.gy != 0;}
    public override canResizeBottom(element:ChildElement){return (element.gy+element.gh) != this.options.rows?.length;}

     // Edit functions

    /**
     * move a grid line (change the fraction ratios of the template)
     * @param line_pos: [x, y] of the moving line(s); if -1: not changed
     * @param move_by: [x, y] translation in px
     * @param box_pos: [x, y] 0 for top/left, 1 for bottom/right
     */
    public moveGridLine(line_pos:[number,number], move_by:[number,number], box_width: number, box_height: number, box_pos:[number,number]) {
        // console.log("move line", line_pos, move_by)

        // move column (x) line
        if (line_pos[0]!=-1) {
            this._moveGridLine(0, line_pos, move_by, box_width, box_height, box_pos);
        }

        // move row (y) line
        if (line_pos[1]!=-1) {
            this._moveGridLine(1, line_pos, move_by, box_width, box_height, box_pos);
        }

    }

    // move for axis x or y
    private _moveGridLine(axis: 0|1, line_pos:[number,number], move_by:[number,number], box_width: number, box_height: number, box_pos:[number,number]) {

        let type = {0: "columns", 1: "rows"};

        let full_fr_width = this.options[type[axis]].reduce((a,v)=>v+a, 0);
        let full_width = axis == 0 ? this.slot_element.offsetWidth : this.slot_element.offsetHeight;

        let size = axis == 0 ? box_width : box_height;

        let box_start, box_end, box;
        // left / right box?
        if (box_pos[axis]==1) {
            box_start = line_pos[axis]-size;
            box_end = line_pos[axis];
        }
        else {
            box_start = line_pos[axis]
            box_end = line_pos[axis]+size;
            move_by[axis] = -move_by[axis];
        }
        box = this.options[type[axis]].slice(box_start, box_end);

        // get current box, before, after
        let box_fr = box.reduce((a,v)=>v+a, 0);
        let box_percent = box_fr / full_fr_width;

        let before = this.options[type[axis]].slice(0, box_start)
        let before_fr = before.reduce((a,v)=>v+a, 0);
        let before_percent = before_fr / full_fr_width;

        let after = this.options[type[axis]].slice(box_end)
        let after_fr = after.reduce((a,v)=>v+a, 0);
        let after_percent = after_fr / full_fr_width;

        // before/after fr stays the same, box region adjusted
        let fr_per_percent;
        if (box_pos[axis]==1 && before_fr!==0) fr_per_percent = before_fr / before_percent;
        else if (box_pos[axis]==0 && after_fr!==0) fr_per_percent = after_fr / after_percent;
        else fr_per_percent = box_fr / box_percent;

        let new_box_column_width = box_percent * full_width + move_by[axis];
        let new_box_fr_percent = new_box_column_width / full_width;

        let new_box_fr = new_box_fr_percent * fr_per_percent;

        let can_change_box = false;

        // change after
        if (box_pos[axis]==1 && after.length) {
            if (after_fr==0) after_fr = 0.00001;
            else can_change_box = true;
            let new_after_fr = (1-new_box_fr_percent-before_percent) * fr_per_percent;
            for (let a=0; a<after.length; a++) {
                after[a] = ((after[a]+0.00001)/after_fr) * new_after_fr
                if (after[a]<0) after[a] = 0;
                if (isNaN(after[a])) return // invalid!!
                this.options[type[axis]][box_end+a] = after[a];
            }
        }
        else if (box_pos[axis]==1) {
            // this.options.grid[type[axis]].push(0.001); //  TODO
        }

        // change before
        if (box_pos[axis]==0 && before.length) {
            if (before_fr==0) before_fr = 0.00001;
            else can_change_box = true;
            let new_before_fr = (1-new_box_fr_percent-after_percent) * fr_per_percent;
            for (let a=0; a<before.length; a++) {
                before[a] = ((before[a]+0.00001)/before_fr) * new_before_fr
                if (before[a]<0) before[a] = 0;
                if (isNaN(before[a])) return // invalid!!
                this.options[type[axis]][a] = before[a];
            }
        }
        else if (box_pos[axis]==0) {
            // this.options.grid[type[axis]].unshift(0.001);
            // TODO shift everything
        }

        // change box if possible
        if (can_change_box) {
            for (let b=0; b<box.length; b++) {
                box[b] = (box[b]/box_fr) * new_box_fr
                if (box[b]<0) box[b] = 0;
                if (isNaN(box[b])) return // invalid!!
                this.options[type[axis]][box_start+b] = box[b];
            }
        }

        // let columns = this.options.grid[type[axis]].map(fr => `minmax(30px,${fr}fr)`).join(" ");
        let columns = this.options[type[axis]].map(fr => `${fr}fr`).join(" ");
        // console.log(columns);
        this.slot_element.style.setProperty("grid-template-" + type[axis], columns);
    }


    protected updateGrid(){

        // auto grid
        if (this.options.auto_size) {
            // exact width / height
            if (this.options.strict_size) {
                this.slot_element.style.gridTemplateColumns = `repeat(auto-fill, ${this.options.column_width}px)`;
                this.slot_element.style.gridTemplateRows = `repeat(auto-fill, ${this.options.row_height}px)`;
            }
            // dynamic, auto find best size
            else {
                this.slot_element.style.gridTemplateColumns = `repeat(auto-fill, minmax(${this.options.column_width}px, 1fr))`;
                this.slot_element.style.gridTemplateRows = `repeat(auto-fill, minmax(${this.options.row_height}px, 1fr))`;
            }
           
            return;
        }


        let columns = this.options.columns.map(fr => `${fr}fr`).join(" ");
        let rows = this.options.rows.map(fr => `${fr}fr`).join(" ");


        this.slot_element.style.gridTemplateColumns = columns;
        this.slot_element.style.gridTemplateRows = rows;

        // if (!this.options.enable_drop) return; // TODO just debug, find a better solution (different option parameter?)

        for (let x=0; x<this.options.columns.length; x++) {
            for (let y=0; y<this.options.rows.length; y++) {
                let ghost_element = document.createElement("div");
                ghost_element.classList.add("ghost-element");
                ghost_element.style.gridColumnStart = (x+1).toString();
                ghost_element.style.gridColumnEnd = (x+2).toString();
                ghost_element.style.gridRowStart = (y+1).toString();
                ghost_element.style.gridRowEnd = (y+2).toString();

                let start_vertex:[number,number] = [x, y];
                let end_vertex:[number,number] = [x+1, y+1];

                Handlers.handleDrop(ghost_element, {
                    drop: async (drop_event)=>{

                        if (drop_event.types.has(Types.DRAGGABLE.ELEMENT_CREATOR)) {
                            let drop_el = await drop_event.data[Types.DRAGGABLE.ELEMENT_CREATOR].get();
                            if (drop_el) {
                                drop_el.constraints.gx = x;
                                drop_el.constraints.gy = y;
                                drop_el.constraints.gw = 1;
                                drop_el.constraints.gh = 1;
                                this.addChild(<ChildElement>drop_el, {}, true);
                            }
                        }

                        else if (drop_event.types.has(Types.DRAGGABLE.ELEMENT)) {
                            let drop_el = drop_event.data[Types.DRAGGABLE.ELEMENT];
                            drop_el.constraints.gx = x;
                            drop_el.constraints.gy = y;
                            drop_el.constraints.gw = 1;
                            drop_el.constraints.gh = 1;
                            this.addChild(<ChildElement>drop_el, {}, true);
                        }

                        else if (drop_event.types.has(Types.DRAGGABLE.URL)) {
                            this.addChild(Webpage, {url: drop_event.data[Types.DRAGGABLE.URL]}, true);
                        }
                    }
                },

                <Base><unknown>{parent: this, options: {start_vertex: start_vertex, end_vertex: end_vertex},
                    updatePosition: (_start_vertex:[number,number], _end_vertex:[number,number]) => {
                        ghost_element.style.gridColumnStart = (start_vertex[0]+1).toString();
                        ghost_element.style.gridColumnEnd = (end_vertex[0]+1).toString();
                        ghost_element.style.gridRowStart = (start_vertex[1]+1).toString();
                        ghost_element.style.gridRowEnd = (end_vertex[1]+1).toString();
                    },
                    hide: () => ghost_element.style.display = 'none',
                    show: () => ghost_element.style.display = 'block'
                }, true, true)

                this.slot_element.append(ghost_element)
            }
        }

    }

}
