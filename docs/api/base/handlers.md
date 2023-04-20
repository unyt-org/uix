## function **Handlers.handleDrop** (element: HTMLElement, drop_handler: Types.drop_handler, uix_element?: Components.Base, add_border: any, multi_area_drop: any, blur_area: any)


Creates a drop listener for a specific dom element
 * @param element:: an html element that handles drop events
 * @param uix_element?:: corresponding UIX element if available
 * @param drop_handler:: handler object handling drop, long_hover, in, out, ...
 * @param add_border:: add a 1px transparent border (set to false if the element already has a border)
 * @param multi_area_drop:: support for pressing shift and selecting multiple neighboring elements to drop to

## function **Handlers.handleDrag** (element: HTMLElement, drag_data: {})



## function **Handlers.handleShortcut** (element: HTMLElement | Window, shortcut_name: string, handler: unknown - todo)



## function **Handlers.showTooltip** (content: string | HTMLElement, x: number, y: number, direction: right | left, tooltip_formatted: any)



## function **Handlers.contextMenu** (element: HTMLElement, items: Types.context_menu, header?: Types.context_menu_header, menu_container?: HTMLElement, trigger_events?: string[], is_primary_menu: any, primary_close?: unknown - todo, primary_position?: {x: number,y: number,}): [unknown - todo, unknown - todo]



