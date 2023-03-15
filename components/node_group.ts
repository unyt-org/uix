import { Component, NoResources, Group as UIXGroup } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { DragGroup } from "./drag_group.ts";
import { property } from "unyt_core";
import { Node, NodeConnection, NodeConnector } from "./node.ts";
import { logger } from "../utils/global_values.ts";

export namespace NodeGroup {
    export interface Options extends DragGroup.Options {
        default_connection_options?: NodeConnection.Options // line, right_angle, ...
    }
}

@UIXGroup("Nodes")
@UIXGroup("Groups")
@Component<NodeGroup.Options>({
    zoomable: true,
    movable: true
})
@NoResources
export class NodeGroup<O extends NodeGroup.Options=NodeGroup.Options, ChildElement extends Base = Base> extends DragGroup<O, ChildElement> {

    override onContainerClicked() {
        if (this.moving_connection) {
            NodeGroup.deleteConnection(this.moving_connection);
            this.content.removeEventListener("mousemove", this.moving_connection_listener)
            this.moving_connection = null;
        }
    }

    override async onCreate(){

        // recreate saved connections
        for (const connection of this.connections) {
            this.addConnection(connection);
        }

        await super.onCreate?.()
    }

    // TODO onShow?
    protected override onAnchor() {
        super.onAnchor();
        // update connection rendering
        for (let connection of this.connections) {
            NodeGroup.node_groups_by_connection.set(connection, this); // save reference to this group
        }
    }

    public override onChildConstraintsChanged(element:Base) {
        if (element instanceof Node) {
            for (let connector of (<Node>element).connectors) {
                for (let connection of NodeGroup.connections_by_connector.get(connector)||[]) {
                    this.updateConnection(connection);
                }
            }
        }
    }

    public static deleteConnection(connection:NodeConnection) {
        
        const group = this.node_groups_by_connection.get(connection);

        // set connectors inactive
        if (connection.c2) {
            this.connections_by_connector.get(connection.c2)?.delete(connection);
            this.nodes_for_connectors.get(connection.c2).setConnectorInactive(connection.c2);
        }
        if (connection.c1) {
            this.connections_by_connector.get(connection.c1)?.delete(connection);
            this.nodes_for_connectors.get(connection.c1).setConnectorInactive(connection.c1);
        }

        // remove from node group
        if (group) group.connections.delete(connection)
        // clear connection state
        connection.remove();
        // remove from DOM
        connection.element.remove(); 
    }

    // update the connection rendering
    public updateConnection(connection: NodeConnection, mouse_e_end?:MouseEvent) {
        connection.handleUpdate(this.outer_container.getBoundingClientRect(), this.options._zoom, mouse_e_end)
    }

    // a node connector has been clicked
    public onNodeConnectorClicked(node:Node, connector:NodeConnector) {

        // close connection
        if (this.moving_connection) {
            const other_connector = this.moving_connection.c1 ?? this.moving_connection.c2;
            const connections = new Set([...NodeGroup.connections_by_connector?.get(connector)??[]]);
            const other_connections = new Set([...NodeGroup.connections_by_connector?.get(other_connector)??[]]);
            other_connections.delete(this.moving_connection);
            connections.delete(this.moving_connection);

            if (!node.isConnectionValid(other_connector.options, connector.options, other_connections.size, connections.size, other_connections, connections)) {
                logger.error("invalid connection");
                return;
            }

            // bind connectors
            if (!this.moving_connection.c1) this.moving_connection.c1 = connector;
            else if (!this.moving_connection.c2) this.moving_connection.c2 = connector; 

            // bind connection
            if (!NodeGroup.connections_by_connector.has(connector)) NodeGroup.connections_by_connector.set(connector, new Set());
            NodeGroup.connections_by_connector.get(connector).add(this.moving_connection);
            this.connections.add(this.moving_connection);
            NodeGroup.node_groups_by_connection.set(this.moving_connection, this);

            this.updateConnection(this.moving_connection);

            // set connector active
            node.setConnectorActive(connector)

            console.log("Connection: ", this.moving_connection.c1, " => ", this.moving_connection.c2)

            // reset
            this.moving_connection = null;
            this.content.removeEventListener("mousemove", this.moving_connection_listener)

        }
        
        // start connection
        else {
            this.startNodeConnection(connector);
        }
    }


    // hovering over a node connector
    public onNodeConnectorMouseIn(node:Node, connector:NodeConnector){
        if (this.moving_connection) {
            // bind temporary connector
            if (!this.moving_connection.c1) this.moving_connection.temp_c1 = connector;
            else if (!this.moving_connection.c2) this.moving_connection.temp_c2 = connector; 
            this.updateConnection(this.moving_connection);
        }
    }

    public onNodeConnectorMouseOut(node:Node, connector:NodeConnector){
        // if (this.moving_connection) {
        //     this.moving_connection.temp_c1 = null;
        //     this.moving_connection.temp_c2 = null;
        //     this.updateConnection(this.moving_connection);
        // }
    }

    // connect node connectors with a line
    public startNodeConnection(connector:NodeConnector) {
        //console.log("start connect", connector);
        const item_data = Node.getItemDataForConnector(connector);
        const [options, end_1, end_2] = this.getDefaultConnectionForConnector(connector.options, item_data);
        this.createConnection(connector, undefined, end_1, end_2, options);
    }

    @property protected connections = new Set<NodeConnection>();
    public static connections_by_connector = new Map<NodeConnector, Set<NodeConnection>>();
    public static node_groups_by_connection = new Map<NodeConnection, NodeGroup>();
    protected static nodes_for_connectors = new Map<NodeConnector, Node>();

    protected moving_connection:NodeConnection = null;
    private moving_connection_listener:(e)=>void = null;


    public setMovingConnection(connection: NodeConnection) {
        this.moving_connection = connection;
        this.moving_connection.element.style.zIndex = "10000";

        this.moving_connection_listener = e=>{
            this.updateConnection(this.moving_connection, e);
        };
        this.content.addEventListener("mousemove", this.moving_connection_listener)
    }

    public createConnection(out_connector?:NodeConnector, in_connector?:NodeConnector, out_end?:string, in_end?:string, options?:NodeConnection.Options){
        const connection = new NodeConnection(this, out_connector, in_connector, out_end, in_end, this.options.default_connection_options ? {...this.options.default_connection_options, ...options} : options);
        this.addConnection(connection);
    }

    public addConnection(connection:NodeConnection){

        // invalid state because a node is missing
        if ((connection.c1 && !NodeGroup.nodes_for_connectors.has(connection.c1)) || (connection.c2 && !NodeGroup.nodes_for_connectors.has(connection.c2))) {
            this.connections.delete(connection)
            logger.error("missing node for connection");
            return;
        }
       
        // bind connectors
        if (connection.c2) {
            if (!NodeGroup.connections_by_connector.has(connection.c2)) NodeGroup.connections_by_connector.set(connection.c2, new Set());
            NodeGroup.connections_by_connector.get(connection.c2).add(connection);
            NodeGroup.nodes_for_connectors.get(connection.c2).setConnectorActive(connection.c2)
        }
        if (connection.c1) {
            if (!NodeGroup.connections_by_connector.has(connection.c1)) NodeGroup.connections_by_connector.set(connection.c1, new Set());
            NodeGroup.connections_by_connector.get(connection.c1).add(connection);
            NodeGroup.nodes_for_connectors.get(connection.c1).setConnectorActive(connection.c1)
        }

        // handle move
        if (!connection.c2 || !connection.c1) {
            this.setMovingConnection(connection);     
        }
        // add to dom
        this.append(connection.element);

        setTimeout(()=>this.updateConnection(connection), 0);
    }

    override onNewElement(element: ChildElement): void {
        super.onNewElement(element);

        // remember which connectors belong to this Node
        if (element instanceof Node) {
            for (let connector of element.connectors) NodeGroup.setConnectorNode(connector, element)
        }
    }
  
    public static setConnectorNode(connector:NodeConnector, node:Node) {
        NodeGroup.nodes_for_connectors.set(connector, node);
    }

    public static getConnectorNode(connector:NodeConnector):Node {
        return NodeGroup.nodes_for_connectors.get(connector);
    }

    public toggleCollapseSelectedElements(){
        for (let el of this.selected_elements) {
            if (el instanceof Node) el.toggleCollapse()
        }
    }

    // @override 
    getDefaultConnectionForConnector(connector_options:any, item_data:Node.item_data):[options?:NodeConnection.Options, end_1?:string, end_2?:string] {
        return []
    }


}