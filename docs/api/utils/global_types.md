## type **Types.ComponentSubClass**\<O extends Components.Base.Options = Components.Base.Options> = unknown - todo & unknown - todo

## type **Types.form_data** = {}

## type **Types.nav_entry** = {title: string,highlight?: boolean,onClick?: unknown - todo,page?: string,}

## type **Types.context_menu_item** = {text: Datex.CompatValue,shortcut?: string,icon?: string,get_pad?: unknown - todo,disabled?: unknown - todo | boolean,handler?: unknown - todo,el?: HTMLElement,sub_menu?: context_menu,trigger_ctx?: unknown - todo,close_ctx?: unknown - todo,_handler_set?: boolean,} | space

## type **Types.context_menu** = {} | context_menu_item[]

## type **Types.context_menu_header** = {title: string,info?: string,left?: boolean,icon?: string,color?: string,}

## type **Types.drop_handler** = {long_hover?: unknown - todo,in?: unknown - todo,out?: unknown - todo,drop?: unknown - todo,drop_condition?: unknown - todo,allowed_types?: Set,}

## type **Types.menu_bar_entries** = {}

## type **Types.element_creator** = {type: single | multiple,get: unknown - todo,getAll: unknown - todo,}

## type **Types.draggable_data** = {[DRAGGABLE.TREE_ITEM]?: string,[DRAGGABLE.URL]?: string,[DRAGGABLE.EXTERNAL_FILE]?: any,[DRAGGABLE.ELEMENT]?: Components.Base,[DRAGGABLE.ELEMENT_CREATOR]?: {type: single | multiple,get: unknown - todo,getAll: unknown - todo,},}

## type **Types.component_constraints** = {w?: number,h?: number,x?: number,y?: number,z?: number,zlayer?: number,gw?: number,gh?: number,gx?: number,gy?: number,index?: number,margin?: number,margin_top?: number,margin_bottom?: number,margin_left?: number,margin_right?: number,dynamic_size?: boolean,resizable?: boolean,draggable?: boolean,}

## enum **Types.DRAGGABLE**

## enum **Types.KEY**

## enum **Types.STICK**

## enum **Types.VERTICAL_ALIGN**

## enum **Types.HORIZONTAL_ALIGN**

## const **Types.AREA**: {LEFT: string,RIGHT: string,BOTTOM: string,TOP: string,BOTTOM_RIGHT: string,BOTTOM_LEFT: string,TOP_RIGHT: string,TOP_LEFT: string,CENTER: string,}

