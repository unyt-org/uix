## type **Node.item_data**\<V = any, O extends object = any> = {type: string,label: string,position: Node.ITEM_POSITION,value: V,options?: O,connectors: NodeConnector[],}

## interface **Node.Options**

## enum **Node.CONNECTOR_POSITION**

## enum **Node.CONNECTOR_VISIBILITY**

## enum **Node.CONNECTOR_ALIGN**

## enum **Node.ITEM_POSITION**

## interface **NodeConnection.Options**

## enum **NodeConnection.LINE_STYLE**

## enum **NodeConnection.LINE_TYPE**

## function **NodeConnection.getGroupBox** (group: SVGGElement)



## function **NodeConnection.addEndType** (type: string, creator: unknown - todo)



## function **NodeConnection.createEndSvg** (type: string, options: NodeConnection.Options)



## const **NodeConnection.DEFAULT_OPTIONS**: Options

## class **Node**\<O extends Node.Options = Node.Options>
### Properties
**connectors**: Set<br>
**connector_dom_elements**: WeakMap<br>
**connector_item_elements**: WeakMap<br>
**item_data_by_generated_item**: WeakMap<br>
**item_data_by_connector_item**: WeakMap<br>
**connector_items_by_item_data**: WeakMap<br>
`protected` **title_div**: HTMLElement<br>
`protected` **body**: HTMLElement<br>
`protected` **collapse_toggle**: Elements.ToggleButton<br>
`protected` **collapsed_title_div**: HTMLElement | void<br>
`protected` **ITEM_DEFAULT_WIDTH**: string<br>


## class **NodeConnector**\<OPTIONS extends object = any>
### Constructors
 **constructor**(position?: CONNECTOR_POSITION, align?: CONNECTOR_ALIGN, options?: OPTIONS)

### Properties
**position**: CONNECTOR_POSITION<br>
**align**: CONNECTOR_ALIGN<br>
**options**: OPTIONS<br>
**active**?: boolean<br>
**translate**?: number<br>


## class **NodeConnection**
### Constructors
 **constructor**(node_group: NodeGroup, c1: NodeConnector | undefined, c2: NodeConnector | undefined, end1?: string, end2?: string, options?: NodeConnection.Options)

### Properties
**c1**: NodeConnector<br>
**c2**: NodeConnector<br>
**options**: NodeConnection.Options<br>
**temp_c1**: NodeConnector<br>
**temp_c2**: NodeConnector<br>
**element**: SVGElement<br>
**x_start**: number<br>
**x_end**: number<br>
**y_start**: number<br>
**y_end**: number<br>
**max_x**: any<br>
**max_y**: any<br>
**min_x**: any<br>
**min_y**: any<br>
**offset**: number<br>
`protected` **vertical_lines**: Map<br>
`protected` **horizontal_lines**: Map<br>
`protected` **node_group**: NodeGroup<br>
`protected` **clickListener**: unknown - todo<br>


