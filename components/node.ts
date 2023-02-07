import { Component, NoResources, Group as UIXGroup } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { I, S } from "../uix_short.ts";
import { Clipboard } from "../base/clipboard.ts";
import { Theme } from "../base/theme.ts";
import { Utils } from "../base/utils.ts";
import { Elements } from "../elements/main.ts";
import { Types } from "../utils/global_types.ts";
import { pointer, props, text, transform } from "unyt_core/datex_short.ts";
import { DragGroup } from "./drag_group.ts";
import { constructor, Datex, property, sync } from "unyt_core";
import { NodeGroup } from "./node_group.ts";
import { assignDefaultPrototype } from "../utils/utils.ts";
import { document } from "../utils/constants.ts";


@UIXGroup("Nodes")
@Component<Node.Options>({
    icon: 'fa-network-wired',
    padding: 10,
    horizontal_align: Types.HORIZONTAL_ALIGN.LEFT,
    vertical_align: Types.VERTICAL_ALIGN.TOP,
    accent_color: Theme.getColor('text'),
    responsive: true,
    default_ctx: false,
    expanded: true
}, {resizable:false})
export class Node<O extends Node.Options=Node.Options> extends Base<O> {
    declare protected title_div: HTMLElement
    declare protected body: HTMLElement
    declare protected collapse_toggle: Elements.ToggleButton

    public connectors = new Set<Node.Connector>();

    // return additional context menu items
    protected override createContextMenu() {
        return {
            copy: {
                text: S('copy'),
                icon: I('fas-copy'),
                shortcut: 'copy',
                handler: async ()=>{
                    Clipboard.putDatexValue(this);
                    // let els = this.parent instanceof DragGroup ? this.parent.getSelectedElements() : [this];
                    // for (let el of els) {
                    //     const clone = await el.clone();
                    //     this.parent.addChild(clone);
                    // }
                }
            },
            delete: {
                text: S('delete'),
                shortcut: 'delete',
                handler: ()=>{
                    if (this.parent instanceof DragGroup) this.parent.removeSelectedElements();
                    else this.remove();
                }
            },
            toggle: {
                text: transform([this.options_props.expanded], (v) => v ? S('collapse') : S('expand')) ,
                shortcut: 'enter',
                handler: ()=>{
                    if (this.parent instanceof NodeGroup) this.parent.toggleCollapseSelectedElements();
                    else this.toggleCollapse();
                }
            },
        }
    }

    protected override onRemove() {
        // remove connections
        for (let connector of this.connectors) {
            for (let connection of NodeGroup.connections_by_connector.get(connector)??[]) {
                NodeGroup.deleteConnection(connection);
            }
        }
    }


    // init only after anchored on parent, otherwise the state (connection with other nodes) cannot be restored
    public override onCreateLayout() {

        // layout
        this.content_container.style.position = "relative";
        this.content_container.style.overflow = "visible";
        this.content.style.position = "";
        this.content_container.setAttribute("tabindex", "-1"); // make content focusable


        // add body
        this.body = document.createElement("div");
        this.body.style.width = "100%";
        this.content.append(this.body);

        this.createBodyLayout();

        this.title_div = this.generateTitleContent() || document.createElement("div");
        this.content.prepend(this.title_div);
    
        // expand / collapse
        if (this.options.expanded) this.expand();
        else this.collapse();
       
        // load fields + connectors
        if (this.options.items) this.loadItems();

        this.addEventListener("dblclick", ()=>this.toggleCollapse());

        this.updateConnectors()

        this.observeConstraint("x", () => this.onConstraintsChanged());
        this.observeConstraint("y", () => this.onConstraintsChanged());
        this.observeConstraint("w", () => this.onConstraintsChanged());
        this.observeConstraint("h", () => this.onConstraintsChanged());
    }

    public override onInit(){
        
        // add title
        if (this.options.title) {
            this.collapsed_title_div = this.generateCollapsedTitleContent();
            // update collapsed title?
            if (this.collapsed_title_div && !this.options.expanded) {
                this.title_div.replaceWith(this.collapsed_title_div);
            }

        }
    }

    // move connectors to right position
    override onResize(){
        this.updateConnectors();
    }

    protected collapsed_title_div:HTMLElement|void

    toggleCollapse() {
        if (this.options.expanded) this.collapse(true);
        else this.expand(true);
    }

    protected collapse(relocate = false){

        if (relocate) {
            this.constraints.x += this.width/2
            this.constraints.y += this.height/2
        }

        // try to load the collapsed title div
        if (this.collapsed_title_div) {
            this.title_div.replaceWith(this.collapsed_title_div);
        }

        this.body.style.display = "none"
        setTimeout(()=>this.updateConnectors(),0)
        this.options.expanded = false;

        if (relocate) {
            this.constraints.x -= this.width/2
            this.constraints.y -= this.height/2
        }
    }
    
    protected expand(relocate = false){

        if (relocate) {
            this.constraints.x += this.width/2
            this.constraints.y += this.height/2
        }

        if (this.collapsed_title_div) {
            this.collapsed_title_div.replaceWith(this.title_div);
        }
        this.body.style.display = ""
        setTimeout(()=>{
            this.updateConnectors()
            
        },0)

        if (relocate) {
            this.constraints.x -= this.width/2
            this.constraints.y -= this.height/2
        }

        this.options.expanded = true;
    }

    // refresh connection positions
    protected updateConnections() {
        if (this.parent instanceof DragGroup) this.parent.onChildConstraintsChanged(this)
    }
    
    static connector_dom_elements = new WeakMap<Node.Connector, HTMLElement>();
    static connector_item_elements = new WeakMap<Node.Connector, HTMLElement>();
    static item_data_by_generated_item = new WeakMap<HTMLElement, Node.item_data>();
    static item_data_by_connector_item = new WeakMap<HTMLElement, Node.item_data>();
    static connector_items_by_item_data = new WeakMap<Node.item_data, HTMLElement>();


    public static getItemDataForConnector(connector: Node.Connector) {
        return this.item_data_by_connector_item.get(this.connector_item_elements.get(connector));
    }

    public setConnectorActive(connector: Node.Connector) {
        connector.active = true;
        // hide when connected
        if (this.options.connector_visibility == Node.CONNECTOR_VISIBILITY.HIDE_WHEN_CONNECTED || this.options.connector_visibility == Node.CONNECTOR_VISIBILITY.HIDE_WHEN_CONNECTED_OR_INACTIVE)
            Node.connector_dom_elements.get(connector).classList.add("hide-out")
        else 
            Node.connector_dom_elements.get(connector).classList.add("active");
        this.onConnectorConnected(connector);
    }

    public setConnectorInactive(connector: Node.Connector) {
        connector.active = false;
        // no more connections on this connection -> no longer active
        if (!NodeGroup.connections_by_connector.get(connector)?.size) {
            if (this.options.connector_visibility == Node.CONNECTOR_VISIBILITY.HIDE_WHEN_CONNECTED)
                Node.connector_dom_elements.get(connector).classList.remove("hide-out")
            else Node.connector_dom_elements.get(connector).classList.remove("active");
        }
        this.onConnectorDisconnected(connector);
    }

    // generate existing items (for reconstruct)
    private loadItems(){
        for (let item_data of this.options.items) {
            this.addItem(item_data, false, false);
        }
        this.updateConnectors();
    }

    protected updateConnectors(){
        let left_connectors = 0,
            right_connectors = 0,
            left_index = 0,
            right_index = 0,
            height;

        // get number of connectors on each side if collapsed
        if (!this.options.expanded) {
            for (let connector of this.connectors) {
                if (connector.position == Node.CONNECTOR_POSITION.LEFT) left_connectors++;
                else if (connector.position == Node.CONNECTOR_POSITION.RIGHT) right_connectors++;
            }
            height = this.offsetHeight;
        }

        // update each connector
        for (let connector of this.connectors) {
            let created_new = false;

            if (!Node.connector_dom_elements.has(connector)) {
                created_new = true;
                Node.connector_dom_elements.set(connector, Utils.createHTMLElement(`<div class='node-connector'></div>`));
            }
          
            let dom_element = Node.connector_dom_elements.get(connector);   

            if (Node.connector_item_elements.has(connector)) {
                    if (connector.position == Node.CONNECTOR_POSITION.LEFT || connector.position == Node.CONNECTOR_POSITION.RIGHT) {
                        if (this.options.expanded) connector.translate = Node.connector_item_elements.get(connector).offsetTop + Node.connector_item_elements.get(connector).offsetHeight/2 - dom_element.offsetHeight/2 + 5; // TODO why +5 ?
                        
                        // handle collapsed node
                        else {
                            if (connector.position == Node.CONNECTOR_POSITION.LEFT) connector.translate =  height * (++left_index/(left_connectors+1));
                            else connector.translate = height * (++right_index/(right_connectors+1));
                        }
                    }
                    else
                        connector.translate = Node.connector_item_elements.get(connector).offsetLeft + Node.connector_item_elements.get(connector).offsetWidth/2 - dom_element.offsetWidth/2 + 5; // TODO why +5 ?
            }

            // right position
            if (connector.position == Node.CONNECTOR_POSITION.LEFT) {
                dom_element.style.left = '0';
                dom_element.style.setProperty(this.connectorAlignToPosition(connector.align??Node.CONNECTOR_ALIGN.START, true), connector.translate+'px');
            }
            else if (connector.position == Node.CONNECTOR_POSITION.RIGHT) {
                dom_element.style.right = '0';
                dom_element.style.setProperty(this.connectorAlignToPosition(connector.align??Node.CONNECTOR_ALIGN.START, true), connector.translate+'px');
                dom_element.style.transform = connector.align==Node.CONNECTOR_ALIGN.END ? 'translate(5px, 5px)':'translate(5px, -5px)' // correct translation

            }
            else if (connector.position == Node.CONNECTOR_POSITION.BOTTOM) {
                dom_element.style.bottom = '0';
                dom_element.style.setProperty(this.connectorAlignToPosition(connector.align??Node.CONNECTOR_ALIGN.START, false), connector.translate+'px');
                dom_element.style.transform = connector.align==Node.CONNECTOR_ALIGN.END ? 'translate(5px, 5px)':'translate(-5px, 5px)' // correct translation

            }
            else if (connector.position == Node.CONNECTOR_POSITION.TOP) {
                dom_element.style.top = '0';
                dom_element.style.setProperty(this.connectorAlignToPosition(connector.align??Node.CONNECTOR_ALIGN.START, false), connector.translate+'px');
            }

            // only init if created new and not only updated
            if (created_new) {
                this.content_container.append(dom_element);

                if (this.options.connector_visibility == Node.CONNECTOR_VISIBILITY.HIDE_WHEN_INACTIVE ||
                    this.options.connector_visibility == Node.CONNECTOR_VISIBILITY.HIDE_WHEN_CONNECTED_OR_INACTIVE ) dom_element.classList.add("hide-out")
                else if (this.options.connector_visibility == Node.CONNECTOR_VISIBILITY.FADE_OUT_WHEN_INACTIVE) dom_element.classList.add("fade-out")

                dom_element.addEventListener("mousedown", e=>{
                    e.stopPropagation();
                    if (this.parent instanceof NodeGroup) this.parent.onNodeConnectorClicked(this, connector);
                })

                dom_element.addEventListener("mouseenter", e=>{
                    e.stopPropagation();
                    if (this.parent instanceof NodeGroup) this.parent.onNodeConnectorMouseIn(this, connector);
                })
                dom_element.addEventListener("mouseleave", e=>{
                    e.stopPropagation();
                    if (this.parent instanceof NodeGroup) this.parent.onNodeConnectorMouseOut(this, connector);
                })
            }
        }

        // update connections
        setTimeout(()=>this.updateConnections(), 0);
    }

    private connectorAlignToPosition(align:Node.CONNECTOR_ALIGN, vertical = false){
        if (vertical) {
            if (align == Node.CONNECTOR_ALIGN.END) return "bottom";
            else return "top";
        }
        else {
            if (align == Node.CONNECTOR_ALIGN.END) return "right";
            else return "left";
        }
    }

    // remove item = dom element + connectors (+ connections)
    public removeItem(element:HTMLElement) 
    public removeItem(index:number) 
    public removeItem(label:string) 
    public removeItem(identifier:string|number|HTMLElement) {
        let item:Node.item_data;

        // get item_data from label string
        if (typeof identifier == "string") {
            for (const i of this.options.items) {
                console.log(i)
                if(i.label == identifier) {
                    item = i;
                    break;
                }
            }
        }

        // get item data from item index
        else if (typeof identifier == "number") {
            item = this.options.items[identifier];
        }

        // get item data from item html element
        else if (identifier instanceof HTMLElement) {
            item = Node.item_data_by_generated_item.get(identifier);
            Node.item_data_by_generated_item.delete(identifier);
        }

        if (!item) throw new Error("Could not remove item");

        // remove item
        this.options.items.splice(this.options.items.indexOf(item), 1);

        const dom_element = Node.connector_items_by_item_data.get(item);
        if (dom_element) {
            dom_element.remove();
            Node.item_data_by_connector_item.delete(dom_element)
            Node.connector_items_by_item_data.delete(item);
        }

        // remove connections + connectors
        for (let connector of item.connectors) {
            for (let connection of NodeGroup.connections_by_connector.get(connector)??[]) {
                NodeGroup.deleteConnection(connection);
            }
            Node.connector_dom_elements.get(connector).remove();
            Node.connector_dom_elements.delete(connector);
            Node.connector_item_elements.delete(connector);
            this.connectors.delete(connector)
        }


        this.updateConnectors();
    }

    // add item dom + save item data in items array, initialize connectors
    addItem(item_data:Node.item_data, focus = false, save = true) {
        if (save) item_data = pointer(item_data);

        let generated_content = this.generateItemContent(item_data, props(item_data).value, focus);
        let content_element:HTMLElement;
        let options: {wrap:boolean} = {wrap: true};

        if (generated_content instanceof HTMLElement) content_element = generated_content;
        else if (typeof generated_content == "object") {content_element = generated_content.element; options = generated_content}
        
        // wrap in container div
        if (options.wrap || !content_element) {
            const container = document.createElement("div");
            container.style.width = "100%";
            container.style.display = "flex";
            container.style.position = "relative";
            container.style.pointerEvents = "none";
            container.style.justifyContent = item_data.position == Node.ITEM_POSITION.RIGHT ? 'flex-end' : 'flex-start';
           
            if (content_element) container.append(content_element);
            else if (typeof generated_content == "string") container.innerHTML = generated_content;

            // ignore mouse events from inside item
            container.addEventListener("mousedown", e=>{
                e.stopPropagation();
            })

            // container is new content
            content_element = container;
        }
        
        if (save) {
            if (!this.options.items) this.options.items = [];
            this.options.items.push(item_data)
        }
        for (let connector of item_data.connectors) {
            if (!connector) {console.error("connector is null"); continue}
            this.connectors.add(connector)
            NodeGroup.setConnectorNode(connector, this);
            Node.connector_item_elements.set(connector, content_element);
        }
        if (generated_content instanceof HTMLElement) Node.item_data_by_generated_item.set(generated_content, item_data);
        Node.item_data_by_connector_item.set(content_element, item_data);
        Node.connector_items_by_item_data.set(item_data, content_element);


        // add to dom
        const parent = this.getItemContainer(item_data);
        if (parent==undefined) throw new Error("parent container for item is undefined")
        parent.append(content_element);
        this.updateConnectors();

        return content_element;
    }
 
    protected static ITEM_DEFAULT_WIDTH = "150px";


    // @implement custom body layout
    protected createBodyLayout(){ }

    // @override custom html generation
    generateItemContent<V>(item_data:Node.item_data<V>, value:Datex.Value<V>, focus = false):string|HTMLElement|false|{element: HTMLElement, wrap:boolean} {
        switch (item_data.type) {

            case 'default': {
                return item_data.label?.toString() ?? "";
            }

            case 'text': {
                const element = new Elements.TextInput(<any>value, {placeholder:item_data.label});
                element.style.width = Node.ITEM_DEFAULT_WIDTH;
                element.style.marginBottom = "5px";
                element.style.pointerEvents = "all";
                return element;
            }

            default: return false;
        }
        
    }

    // @override
    getItemContainer(item_data: Node.item_data): HTMLElement{
        return this.body;
    }

    // @override
    generateTitleContent():HTMLElement|void {
        const div = document.createElement("div");
        div.append(this.getCollapseToggleButton());
        div.append(new Elements.Text(<Datex.Value<string>>this.options_props.title));

        Utils.setCSSProperty(div, 'color', this.options.accent_color);
        div.style.marginBottom = "10px";
        div.style.fontFamily = "sans-serif";
        div.style.fontWeight = "bold";
        return div;
    }

    // @override create custom title div for coollapsed stat
    generateCollapsedTitleContent():HTMLElement|void {

    }

    getCollapseToggleButton(){
        const chevron = text();
        this.collapse_toggle = new Elements.ToggleButton({
            content: chevron, 
            checked: <Datex.Value<boolean>> this.options_props.expanded,
            onChange: checked => {
                chevron.value = checked ? I('fas-chevron-down') : I('fas-chevron-right');
                this.toggleCollapse();
            }
        }).css({
            'background':'none',
            'min-width': '30px'
        })

        return this.collapse_toggle;
    }

    // @override
    // options for other connector, options for current connector, number of existing connections for other connector, number of existing connections for current connector
    isConnectionValid(options_1:object, options_2:object, connection_count_1:number, connection_count_2:number, connections_1:Set<Node.Connection>, connections_2:Set<Node.Connection>) {
        return true;
    }


    // @override
    protected onConnectorConnected(connector: Node.Connector) {}
    protected onConnectorDisconnected(connector: Node.Connector) {}

    override onShow(){
        this.updateConnectors();
    }

    protected override onConstraintsChanged() {
        // TODO update w,h,x,y seperately?
        setTimeout(()=>this.updateConnections(), 0);
    }



    // get all nodes connected to this node (parent must exist)
    // return array has an entry for each item, sorted
    // own_options: {option1: 'must be', options2: ['either a', 'or b']}
    public getConnectedNodes<OPTIONS extends object = object>(own_options?:OPTIONS, other_options?:OPTIONS, only_first = false): {[item_index:number]: {node:Node, connection:Node.Connection}[]|undefined} {

        const items = {};
        let index = 0;
        for (let item of this.options.items) {
            let item_data: {node:Node, connection:Node.Connection}[];

            own_connectors:
            for (let connector of item.connectors) {
                // does own connector match options?
                if (own_options) {
                    for (let [key, value] of Object.entries(own_options)) {
                        if (value instanceof Array && !value.includes(connector.options?.[key])) continue own_connectors;
                        if (!(value instanceof Array) && value !== connector.options?.[key]) continue own_connectors;
                    }
                }

                // go through all connections for this connector
                other_connectors:
                for (let connection of NodeGroup.connections_by_connector.get(connector) || []) {
                    const other_connector = connection.c1 == connector ? connection.c2 : connection.c1;
                    // does other_connector match options?
                    if (other_options) {
                        for (let [key, value] of Object.entries(other_options)) {
                            if (value instanceof Array && !value.includes(other_connector.options?.[key])) continue other_connectors;
                            if (!(value instanceof Array) && value !== other_connector.options?.[key]) continue other_connectors;
                        }
                    }

                    // add connection data list
                    if (!item_data) items[index] = item_data = [];
                    // add connection data
                    item_data.push({node:NodeGroup.getConnectorNode(other_connector), connection})

                    if (only_first) return items;
                }
                
            }
            index++;
        }

        return items;
    }

    public getConnectedNode(own_options?:object, other_options?:object): {node:Node, connection:Node.Connection} {
        return Object.values(this.getConnectedNodes(own_options, other_options, true))[0]?.[0]
    }

    // get indices for all fields that have no connection on all connectors that match the options
    public getUnconnectedItemIndices(own_options?:object) {
        const indices = [];
        let index = 0;

        for (let item of this.options.items??[]) {

            let is_unconnected = true;

            own_connectors:
            for (let connector of item.connectors) {
                // does own connector match options?
                if (own_options) {
                    for (let [key, value] of Object.entries(own_options)) {
                        if (value instanceof Array && !value.includes(connector.options?.[key])) continue own_connectors;
                        if (!(value instanceof Array) && value !== connector.options?.[key]) continue own_connectors;
                    }
                }

                // has a connection?
                if (NodeGroup.connections_by_connector.get(connector)?.size) {
                    is_unconnected = false;
                    break;
                }
            }

            if (is_unconnected) indices.push(index);
            index++;
        }

        return indices;
    }
}

export namespace Node {
    export enum CONNECTOR_POSITION {
        LEFT = 0,
        RIGHT = 1,
        TOP = 2,
        BOTTOM = 3,
    }

    export enum CONNECTOR_VISIBILITY {
        SHOW_ALWAYS,
        HIDE_WHEN_INACTIVE,
        FADE_OUT_WHEN_INACTIVE,
        HIDE_WHEN_CONNECTED,
        HIDE_WHEN_CONNECTED_OR_INACTIVE
    }

    export enum CONNECTOR_ALIGN {
        START = 0,
        END = 1
    }
    
    export enum ITEM_POSITION {
        LEFT = 0,
        RIGHT = 1,
    }

    export interface Options extends Base.Options {
        connector_visibility?: Node.CONNECTOR_VISIBILITY, // how to display connectors
        expanded?: boolean,
        items?: {type:string, label:string, position:number, value:any, options?:object, connectors:Node.Connector[]}[] // items with content and list of connector ids/names
    }

    export type item_data<V=any, O extends object=any> = {type:string, label:string, position:Node.ITEM_POSITION, value:V, options?:O, connectors:Node.Connector[]};
}


export namespace Node {

    @sync("uix:NodeConnector") export class Connector<OPTIONS extends object = any> {
    
        @property position: CONNECTOR_POSITION;
        @property align: CONNECTOR_ALIGN;
        @property options: OPTIONS;
    
        active: boolean;
        translate: number;
    
        constructor(
            position?: CONNECTOR_POSITION,
            align?: CONNECTOR_ALIGN,
            options?: OPTIONS
        ){}
        
        @constructor construct(position:CONNECTOR_POSITION, align: CONNECTOR_ALIGN, options:OPTIONS) {
            this.position = position;
            this.align = align;
            this.options = options;
        }
    }
    
  
    
    
    @sync("uix:Connection") export class Connection {
    
        #end1:string
        #end2:string

        #end1_svg:SVGGElement;
        #end2_svg:SVGGElement;

        
        @property c1:Connector
        @property c2:Connector
        @property set end1(type:string) {
            this.#end1 = type;
            if (this.#end1) {
                this.#end1_svg = Connection.createEndSvg(this.#end1, this.options)
                // larger offset required?
                this.offset = Math.max(this.offset, Connection.getGroupBox(this.#end1_svg).width, Connection.getGroupBox(this.#end1_svg).height)
            }
        }
        get end1() {return this.#end1}
        @property set end2(type:string) {
            this.#end2 = type;
            if (this.#end2) {
                this.#end2_svg = Connection.createEndSvg(this.#end2, this.options)
                // larger offset required?
                this.offset = Math.max(this.offset, Connection.getGroupBox(this.#end2_svg).width, Connection.getGroupBox(this.#end2_svg).height)
            }
        }
        get end2() {return this.#end2}
        @property options:Connection.Options

        temp_c1:Connector;
        temp_c2:Connector

        protected static vertical_lines = new Map<number, Connection>(); // keep track of all vertical line positions to prevent collisions
        protected static horizontal_lines = new Map<number, Connection>(); // keep track of all horizontal line positions to prevent collisions

        public element:SVGElement
    
        protected node_group: NodeGroup
    
        x_start:number
        x_end:number
        y_start:number
        y_end:number
    
        get start_facing(){return this.getFacing(this.c1?.position ?? this.temp_c1?.position ?? CONNECTOR_POSITION.RIGHT)}
        // c2 facing or temp c2 facing opposite c1 facing
        get end_facing(){return this.c2?.position==undefined ? 
            (this.temp_c2?.position==undefined ? {x:-this.start_facing.x, y:-this.start_facing.y} : this.getFacing(this.temp_c2.position)) :
            this.getFacing(this.c2.position)
        }
     
        get delta_x(){return this.x_end - this.x_start}
        get delta_y(){return this.y_end - this.y_start}
    
        // get {x,y} from CONNECTOR_POSITION
        private getFacing(position: CONNECTOR_POSITION): {x:number, y:number} {
            switch (position) {
                case CONNECTOR_POSITION.RIGHT: return {x:1, y:0};
                case CONNECTOR_POSITION.LEFT: return {x:-1, y:0};
                case CONNECTOR_POSITION.TOP: return {x:0, y:-1};
                case CONNECTOR_POSITION.BOTTOM: return {x:0, y:1};
                default: return {x:1, y:0};
            }
        }

        // get angle in degrees in range (-180, 180)
        private getFacingAngle(facing: {x:number, y:number}) {
            return Math.atan2(facing.y, facing.x) * (180/Math.PI)
        }
        // mirror angle around axis in range (-180, 180)
        private mirrorAngle(angle:number, axis:'x'|'y' = 'y') {
            if (axis == 'x') return -angle;
            else return -angle + (180*Math.sign(angle) || -180) // -180 is special case angle = 0
        }
    
        max_x = -Infinity
        max_y = -Infinity
        min_x = Infinity
        min_y = Infinity
    
        offset = 10;
    
        protected clickListener = ()=>{
            console.log("click node connection",this)
        }
    
        constructor(node_group:NodeGroup, c1:Connector=undefined, c2:Connector=undefined, end1?:string, end2?:string, options?:Connection.Options) {
            this.options = assignDefaultPrototype(Connection.DEFAULT_OPTIONS, options);

            this.c1 = c1;
            this.c2 = c2;
            this.end1 = end1;
            this.end2 = end2;

            this.node_group = node_group;
            
            // create svg
            this.element = document.createElementNS('http://www.w3.org/2000/svg','svg');
            this.element.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
            this.element.setAttribute('width', '0');
            this.element.setAttribute('height', '0');
            this.element.style.position = "absolute";
            this.element.style.pointerEvents = "none";
            this.element.style.zIndex = "-1";
    
            // create custom element
            //this.create()
        }
    
    
        // call to update element
        handleUpdate(bounds:DOMRect, scale:number, mouse_e_end?:MouseEvent){
      
            if (this.c1 && Node.connector_dom_elements.has(this.c1)) {
                const rect = Node.connector_dom_elements.get(this.c1).getBoundingClientRect();
                let relative_x = rect.x + rect.width/2;
                let relative_y = rect.y + rect.height/2;

                this.x_start = (relative_x - bounds.x) / scale;
                this.y_start = (relative_y - bounds.y) / scale;
            }

            if (this.c2 && Node.connector_dom_elements.has(this.c2)) {
                const rect = Node.connector_dom_elements.get(this.c2).getBoundingClientRect();
                let relative_x = rect.x + rect.width/2;
                let relative_y = rect.y + rect.height/2;

                this.x_end = (relative_x - bounds.x) / scale;
                this.y_end = (relative_y - bounds.y) / scale;
            }

            // let c_out_bounds = Node.connector_dom_elements.has(this.c1) ? Node.connector_dom_elements.get(this.c1).getBoundingClientRect() : null;
            // let c_in_bounds =  Node.connector_dom_elements.has(this.c2) ? Node.connector_dom_elements.get(this.c2).getBoundingClientRect() : null;
    
            // if (c_out_bounds) {
            //     this.x_start = (c_out_bounds.x - bounds.x) / scale;
            //     this.y_start = (c_out_bounds.y - bounds.y) / scale;     
            //     this.x_start += shift_x;
            //     this.y_start += shift_y;
            // }
            // if (c_in_bounds) {
            //     this.x_end = (c_in_bounds.x - bounds.x) / scale;
            //     this.y_end = (c_in_bounds.y - bounds.y) / scale;
            //     this.x_end += shift_x;
            //     this.y_end += shift_y;
            // }
    
            if (mouse_e_end) {
                this.x_end = (mouse_e_end.clientX - bounds.x) / scale;
                this.y_end = (mouse_e_end.clientY - bounds.y) / scale;
            }

            // handle update - custom
            this.reset();
    
            // update if all coordinates are defined
            if (this.x_end != undefined && this.y_end != undefined) this.update(); 
        }
    
        protected updateSize(new_xs:number[], new_ys:number[]) {
    
            // update min/max
            this.max_x = Math.max(this.max_x, ...new_xs)
            this.min_x = Math.min(this.min_x, ...new_xs)
    
            this.max_y = Math.max(this.max_y, ...new_ys)
            this.min_y = Math.min(this.min_y, ...new_ys)
    
            let w = (this.max_x-this.min_x+this.offset*2);
            let h = (this.max_y-this.min_y+this.offset*2)
    
            // invalid
            if (isNaN(this.min_x) || !isFinite(this.min_x) || isNaN(this.max_x) || !isFinite(this.max_x) ||
                isNaN(this.min_y) || !isFinite(this.min_y) || isNaN(this.max_y) || !isFinite(this.max_y)
            ) return;
    
            this.element.setAttribute('width', w+'px');
            this.element.setAttribute('height', h+'px');
            this.element.style.top = this.min_y - this.offset + 'px';
            this.element.style.left = this.min_x - this.offset + 'px';
        }
    
        // x with shift
        protected getSvgX(x:number) {
            return (x-this.min_x+this.offset)
        }
        // y with shift
        protected getSvgY(y:number) {
            return (y-this.min_y+this.offset)
        }
    
        protected addDebugPoint(x:number, y:number) {
    
            const point = document.createElementNS('http://www.w3.org/2000/svg','circle');
            point.setAttribute('cx',this.getSvgX(x).toString());
            point.setAttribute('cy',this.getSvgY(y).toString());
            point.setAttribute('r', '5');
            point.setAttribute("fill", "var(--red)")
            
            this.element.append(point);
        }
    
       
        // reset before update, delete content and reset params
        protected reset(){
            this.element.innerHTML = ""; // clear svg content
    
            // reset min max
            this.max_x = -Infinity
            this.max_y = -Infinity
            this.min_x = Infinity
            this.min_y = Infinity
        }
    
        protected updateEnd(end_svg:SVGGElement, facing:{x:number, y:number}, pos: {x:number, y:number}){
            const angle = this.getFacingAngle(facing);
            const box = Connection.getGroupBox(end_svg);

            // facing up, end direction down
            if (angle == -90) {
                pos.y -= box.width;
                end_svg.setAttribute("transform", `translate(${this.getSvgX(pos.x)}, ${this.getSvgY(pos.y-box.height/2)}) rotate(${this.mirrorAngle(angle, 'x')})`);  
            }
            // facing down, end direction up
            if (angle == 90) {
                pos.y += box.width;
                end_svg.setAttribute("transform", `translate(${this.getSvgX(pos.x)}, ${this.getSvgY(pos.y-box.height/2)}) rotate(${this.mirrorAngle(angle, 'x')})`);  
            }
            // facing left, end direction right
            else if (angle == -180 || angle == 180) {
                pos.x -= box.width;
                end_svg.setAttribute("transform", `translate(${this.getSvgX(pos.x)}, ${this.getSvgY(pos.y-box.height/2)}) rotate(${this.mirrorAngle(angle, 'y')})`);  
            }
            // facing right, end direction left
            else if (angle == 0) {
                pos.x += box.width;
                end_svg.setAttribute("transform", `translate(${this.getSvgX(pos.x)}, ${this.getSvgY(pos.y-box.height/2)}) rotate(${this.mirrorAngle(angle, 'y')})`);  
            }
        }
    
        protected update() {
            // new min/max points?
            this.updateSize([this.x_start, this.x_end], [this.y_start, this.y_end]);

            // ends
            if (this.#end1_svg) {
                this.element.append(this.#end1_svg);
                const pos = {x:this.x_start, y:this.y_start};
                this.updateEnd(this.#end1_svg, this.start_facing, pos);
                // update changed x y
                this.x_start = pos.x;
                this.y_start = pos.y;
            }
            if (this.#end2_svg) {
                this.element.append(this.#end2_svg);
                const pos = {x:this.x_end, y:this.y_end};
                this.updateEnd(this.#end2_svg, this.end_facing, pos);
                // update changed x y
                this.x_end = pos.x;
                this.y_end = pos.y;
            }
                
            // draw different line types
            switch (this.options.line_type) {
                case (Connection.LINE_TYPE.LINE): this.createLine(); break;
                case (Connection.LINE_TYPE.CURVE): this.createCurve(); break;
                case (Connection.LINE_TYPE.ANGULAR): this.createPath(false); break;
                case (Connection.LINE_TYPE.ROUNDED): this.createPath(true); break;
                default: throw new Error("Invalid connection line type");
            }

           
        }

        protected createLine(){
            const x_start = this.getSvgX(this.x_start),
            y_start = this.getSvgY(this.y_start),
            x_end   = this.getSvgX(this.x_end),
            y_end   = this.getSvgY(this.y_end);

            const line = document.createElementNS('http://www.w3.org/2000/svg','line');
            line.setAttribute('x1',x_start.toString());
            line.setAttribute('y1',y_start.toString());
            line.setAttribute('x2',x_end.toString());
            line.setAttribute('y2',y_end.toString());
            line.setAttribute("stroke", this.options.line_color)
            line.setAttribute("stroke-linecap", "round");
            line.setAttribute("stroke-width", this.options.line_width+"px")
            if (this.options.line_style == Node.Connection.LINE_STYLE.DASHED) line.setAttribute("stroke-dasharray", "10,4")
            else if (this.options.line_style == Node.Connection.LINE_STYLE.DOTTED) line.setAttribute("stroke-dasharray", `1,4`)
            this.element.append(line);
        }


        protected createCurve(){
            const x_start = this.getSvgX(this.x_start),
            y_start = this.getSvgY(this.y_start),
            x_end   = this.getSvgX(this.x_end),
            y_end   = this.getSvgY(this.y_end);

            const factor = 0.5;
    
            let p1_x    = x_end - (x_end-x_start)*factor,
                p1_y    = y_start,
                p2_x    = x_start + (x_end-x_start)*factor,
                p2_y    = y_end;

            let path = document.createElementNS('http://www.w3.org/2000/svg','path');
            path.setAttribute('d',`M ${x_start} ${y_start} C ${p1_x} ${p1_y}, ${p2_x} ${p2_y}, ${x_end} ${y_end}`);
            path.setAttribute("stroke", this.options.line_color)
            path.setAttribute("fill", "transparent")
            path.setAttribute("stroke-linecap", "round");
            path.setAttribute("stroke-width", this.options.line_width+"px")
            if (this.options.line_style == Node.Connection.LINE_STYLE.DASHED) path.setAttribute("stroke-dasharray", "10,4")
            else if (this.options.line_style == Node.Connection.LINE_STYLE.DOTTED) path.setAttribute("stroke-dasharray", `1,4`)

            this.element.append(path);
        }


        // reset state 
        public remove() {
            if (Connection.horizontal_lines.get(this.#last_y_pos) == this) Connection.horizontal_lines.delete(this.#last_y_pos)
            if (Connection.vertical_lines.get(this.#last_x_pos) == this) Connection.vertical_lines.delete(this.#last_x_pos)
        }

        #last_x_pos:number
        #last_y_pos:number

        // prevent collision with vertical lines
        protected shiftCollisionX(x_pos:number): number{
            let rounded_x_pos = Math.ceil(x_pos / 10) * 10;
            
            // first delete old vertical line entry
            if (Connection.vertical_lines.get(this.#last_x_pos) == this) Connection.vertical_lines.delete(this.#last_x_pos)
            // check if collision
            let dir = undefined;
            while (Connection.vertical_lines.has(rounded_x_pos)) {
                // first decide which direction to shift (don't shift forward and backward)
                if (dir == undefined) {
                    let other = Connection.vertical_lines.get(rounded_x_pos);
                    if (other.delta_y > 0) dir = -Math.min(20,Math.abs(other.y_start-this.y_start))||20; // x shift same value as y distance
                    else dir = Math.min(20, Math.abs(other.y_start-this.y_start))||20;
                }
                x_pos += dir;
                rounded_x_pos = Math.ceil(x_pos / 10) * 10;
            }
            Connection.vertical_lines.set(rounded_x_pos, this);
            this.#last_x_pos = rounded_x_pos;
            return x_pos;
        }

        protected shiftCollisionY(y_pos:number): number{
            let rounded_y_pos = Math.ceil(y_pos / 10) * 10;
            
            // first delete old vertical line entry
            if (Connection.horizontal_lines.get(this.#last_y_pos) == this) Connection.horizontal_lines.delete(this.#last_y_pos)
            // check if collision
            while (Connection.horizontal_lines.has(rounded_y_pos)) {
                y_pos += 11;
                rounded_y_pos = Math.ceil(y_pos / 10) * 10;
            }
            Connection.horizontal_lines.set(rounded_y_pos, this);
            this.#last_y_pos = rounded_y_pos;
            return y_pos;
        }


        protected createPath(rounded = true) {
            const points:[number, number][] = [];
            
            // TODO why is that required? flip flips sign to -1 if sign(delta_x) != sign(start_facing)
            const flip_x = Math.sign(this.start_facing.x)*Math.sign(this.delta_x);
            const flip_y = Math.sign(this.start_facing.y)*Math.sign(this.delta_y);
    
            // is the end facing 180° rotated to the start facing?
            const facing_opposite = this.start_facing.x == -this.end_facing.x && this.start_facing.y == -this.end_facing.y;
    
            // start
            points.push([this.x_start, this.y_start]);
    
            // Z shape
            if (facing_opposite) {
                let x_pos_1 = this.x_start+flip_x*this.start_facing.x*Math.abs(this.delta_x/2);
                let x_pos_2 = this.x_end+flip_x*this.end_facing.x*Math.abs(this.delta_x/2);
                let y_pos_1 = this.y_start+flip_y*this.start_facing.y*Math.abs(this.delta_y/2);
                let y_pos_2 = this.y_end+flip_y*this.end_facing.y*Math.abs(this.delta_y/2);

                // x pos should be adjusted for collisions
                if (x_pos_1 == x_pos_2) x_pos_1 = x_pos_2 = this.shiftCollisionX(x_pos_1)
                // y pos should be adjusted for collisions
                //if (y_pos_1 == y_pos_2) y_pos_1 = y_pos_2 = this.shiftCollisionY(y_pos_1)

                // facing from start
                points.push([x_pos_1, y_pos_1]);
                // facing from end
                points.push([x_pos_2, y_pos_2]);
            }
    
            // L shape
            else {
                // center point
                points.push([this.x_start+flip_x*this.start_facing.x*Math.abs(this.delta_x), this.y_start+flip_y*this.start_facing.y*Math.abs(this.delta_y)]);
            }
           
            // end
            points.push([this.x_end, this.y_end]);
    
    
            //console.log(points);
    
            // render debug points
            //points.forEach(([x,y])=>this.addDebugPoint(x,y))
    
            this.createPathSVG(points, rounded);
        }


        protected createPathSVG(points:[number, number][], rounded = true) {
            const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    
            // start point
            let path_string = `M ${this.getSvgX(points[0][0])} ${this.getSvgY(points[0][1])} `
            let p = 1;
    
            for (p; p<points.length; p++) {
                const [x,y] = points[p];
    
                // point afterwards?
                if (p<points.length-1 && rounded) {
    
                    const x_prev_shift = Math.sign(x-points[p-1][0]) * Math.min(10, Math.abs(points[p-1][0]-x)/2)
                    const y_prev_shift = Math.sign(y-points[p-1][1]) * Math.min(10, Math.abs(points[p-1][1]-y)/2)
    
                    const x_next_shift = Math.sign(points[p+1][0]-x) * Math.min(10, Math.abs(points[p+1][0]-x)/2)
                    const y_next_shift = Math.sign(points[p+1][1]-y) * Math.min(10, Math.abs(points[p+1][1]-y)/2)
        
                    path_string += `L ${this.getSvgX(x-x_prev_shift)} ${this.getSvgY(y-y_prev_shift)} `
                    path_string += `C ${this.getSvgX(x)} ${this.getSvgY(y)} ${this.getSvgX(x)} ${this.getSvgY(y)} ${this.getSvgX(x+x_next_shift)} ${this.getSvgY(y+y_next_shift)} `
                }
                // last point (or no round edges)
                else {
                    path_string += `L ${this.getSvgX(x)} ${this.getSvgY(y)} `
                }
             
            }
    
            path.setAttribute('d', path_string);
            path.setAttribute("stroke", this.options.line_color);
            path.setAttribute("stroke-linecap", "round");
            path.setAttribute("fill", "transparent");
            path.setAttribute("stroke-width", this.options.line_width+"px");
            if (this.options.line_style == Node.Connection.LINE_STYLE.DASHED) path.setAttribute("stroke-dasharray", "10,4")
            else if (this.options.line_style == Node.Connection.LINE_STYLE.DOTTED) path.setAttribute("stroke-dasharray", `1,4`)
    
            this.element.append(path);
        }


    }

    export namespace Connection {

        export enum LINE_STYLE {
            SOLID,
            DASHED,
            DOTTED
        }

        export enum LINE_TYPE {
            LINE,
            CURVE,
            ANGULAR,
            ROUNDED
        }

        export interface Options {
            line_style?: Connection.LINE_STYLE
            line_type?: Connection.LINE_TYPE
            line_color?: string
            line_width?: number
        }

        export const DEFAULT_OPTIONS:Options = {
            line_style: Connection.LINE_STYLE.SOLID,
            line_type: Connection.LINE_TYPE.LINE,
            line_color: "var(--text)",
            line_width: 2
        }

        Datex.Type.get("uixopt:LineConnection").setJSInterface({
            prototype: DEFAULT_OPTIONS,
            proxify_children: true,
            is_normal_object: true,
        })


        const end_type_creators = new Map<string, (options:Connection.Options)=>SVGElement>()
        const group_boxes = new WeakMap<SVGGElement, SVGRect>()

        export function getGroupBox(group: SVGGElement) {
            return group_boxes.get(group);
        }

        export function addEndType(type:string, creator:(options:Connection.Options)=>SVGElement) {
            end_type_creators.set(type, creator);
        }

        export function createEndSvg(type: string, options:Connection.Options) {
            if (!end_type_creators.has(type)) throw new Error("Unknown connection end type: " + type);

            const group = document.createElementNS('http://www.w3.org/2000/svg','g');
            const inner_svg = end_type_creators.get(type)(options);
            group.appendChild(inner_svg);

            // add temporarily to dom to get bounding box size
            let tempDiv = document.createElement('div')
            tempDiv.setAttribute('style', "position:absolute; visibility:hidden; width:0; height:0")
            document.body.appendChild(tempDiv)
            let tempSvg = document.createElementNS("http://www.w3.org/2000/svg", 'svg')
            tempDiv.appendChild(tempSvg)
            tempSvg.appendChild(group)
            group_boxes.set(group, group.getBBox())
            document.body.removeChild(tempDiv)
            
            // origin x:left, y:center
            group.setAttribute("transform-origin", `0 ${getGroupBox(group).height/2}`);  

            return group;
        }


    }

    
    // @sync("uix:PathNodeConnection") export class PathConnection extends Connection {
    //     override type = 'path'
    
    //     protected update() {
    
    //         const SEGMENT_SIZE = 140;
    
    //         let current_x = this.x_start,
    //             current_y = this.y_start,
    //             dir_x     = this.x_end - current_x,
    //             dir_y     = this.y_end - current_y;
    
    //         let i = 0;
    //         let dir = [Math.sign(dir_x),0] // tell in which direction [x,y] to move next
    //         while(i++<6) {
    //             // move in x direction
    //             if (dir[0]) {
    //                 let fits = Math.abs(dir_x)<SEGMENT_SIZE;  // hit the target x position directly
    //                 let add_x = fits ? dir_x : dir[0]*SEGMENT_SIZE;
    //                 if (fits || !this.node_group.hasCollision(current_x+add_x, current_y)) {
    //                     this.addLineSegment(current_x, current_y, add_x, 0)
    //                     current_x += add_x;
    //                 }
    //                 else {
    //                     dir[0] = 0;
    //                     dir[1] = Math.sign(dir_y);
    //                 }
    
    //                 // check if distance got smaller, else change direction to y if possible
    //                 if ( (this.x_end - current_x) >= dir_x) {
    //                     if (!this.node_group.hasCollision(current_y, current_y+Math.sign(dir_y)*SEGMENT_SIZE)) {
    //                         dir[0] = 0;
    //                         dir[1] = Math.sign(dir_y);
    //                     }
    //                 }
    //             }
    //             // move in y direction
    //             if (dir[1]) {
    //                 let fits = Math.abs(dir_y)<SEGMENT_SIZE;  // hit the target y position directly
    //                 let add_y = fits ? dir_y : dir[1]*SEGMENT_SIZE;
    //                 if (fits || !this.node_group.hasCollision(current_x, current_y+add_y)) {
    //                     this.addLineSegment(current_x, current_y, 0, add_y)
    //                     current_y += add_y;
    //                 }
    //                 else {
    //                     dir[1] = 0;
    //                     dir[0] = Math.sign(dir_x);
    //                 }
    
    //                 // check if distance got smaller, else change direction to x if possible
    //                 if ( (this.y_end - current_y) >= dir_y) {
    //                     if (!this.node_group.hasCollision(current_x+Math.sign(dir_x)*SEGMENT_SIZE, current_y)) {
    //                         dir[1] = 0;
    //                         dir[0] = Math.sign(dir_x);
    //                     }
    //                 }
    //             }
               
    //             dir_x     = this.x_end - current_x,
    //             dir_y     = this.y_end - current_y;
    //         }
    
    //     }
    // }
    
}