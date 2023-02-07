
/** TYPES, INTERFACES, ENUMS */

import { Datex } from "unyt_core";
import { UnytPenPad } from "../base/unyt_pen.ts";
import { Components } from "../components/main.ts";

export namespace Types {

	export type ComponentSubClass<O extends Components.Base.Options = Components.Base.Options> =
  (new (options?:O) => Components.Base<O>) & { [K in keyof typeof Components.Base]: typeof Components.Base[K] }

  	export type form_data = {[option_name:string]:{type?:string, name?:string, default?:any}}; // used for Form Snippet


	export type nav_entry = {
		title:string, // display title
		highlight?:boolean, // highlighted color
		onClick?:()=>void, // call when clicked
		page?: string // page to show when clicked
	}

	export type context_menu_item = {text:Datex.CompatValue<string>, shortcut?:string, icon?:string, get_pad?:()=>UnytPenPad, disabled?:(()=>boolean)|boolean, handler?:(x:number, y:number)=>void,el?:HTMLElement, sub_menu?:context_menu, trigger_ctx?:(e, hide_other:boolean, overrideX?:number, overrideY?:number)=>void, close_ctx?:(delete_container?:boolean)=>void,_handler_set?:boolean}|"space"
	export type context_menu = {[id:string]:context_menu_item}|context_menu_item[];
	export type context_menu_header = {title:string,info?:string,left?:boolean,icon?:string,color?:string};
	export type drop_handler = {long_hover?:()=>void, in?:(e:DragEvent)=>void, out?:(e:DragEvent)=>void, drop?:(drop_event:{types:Set<Types.DRAGGABLE>, data:draggable_data})=>void, drop_condition?:()=>void, allowed_types?:Set<Types.DRAGGABLE>};

	export type menu_bar_entries = {[name:string]:context_menu} 

	export type element_creator = {type:"single"|"multiple", get:(data:any)=>Promise<Components.Base>, getAll:(data:any)=>Promise<Components.Base[]>};

	export enum DRAGGABLE {
		TREE_ITEM       = "uix_tree_item",
		ELEMENT         = "uix_element",
		ELEMENT_CREATOR = "uix_element_creator",
		EXTERNAL_FILE   = "uix_external_file",
		URL             = "uix_url",
		TEXT            = "uix_text"
	}


	export type draggable_data = {
		[DRAGGABLE.TREE_ITEM]?:string // a tree item (e.g. dragged out from a file tree)
		[DRAGGABLE.URL]?:string  // an external url
		[DRAGGABLE.EXTERNAL_FILE]?:any,   // a file dragged in from the OS
		[DRAGGABLE.ELEMENT]?:Components.Base, // an already existing element
		[DRAGGABLE.ELEMENT_CREATOR]?:{type:"single"|"multiple", get:()=>Promise<Components.Base>, getAll:()=>Promise<Components.Base[]>}  // a method that can be called to create a corresponding element
	}


	export enum KEY {CTRL = "Control", TAB = "Tab", SHIFT = "Shift", DELETE = "Delete", BACKSPACE = "Backspace"}
	export enum STICK {LEFT, RIGHT, BOTTOM, TOP}
	export enum VERTICAL_ALIGN  {CENTER = "center", TOP = "flex-start", BOTTOM = "flex-end"}
	export enum HORIZONTAL_ALIGN  {CENTER = "center", RIGHT = "flex-end", LEFT = "flex-start"}
	export const AREA = {LEFT: "left", RIGHT: "right", BOTTOM: "bottom", TOP: "top", BOTTOM_RIGHT: "bottom-right", BOTTOM_LEFT: "bottom-left", TOP_RIGHT: "top-right", TOP_LEFT: "top-left", CENTER: "center"} as const;

	export type component_constraints = {
		w?:number,
		h?:number,
		x?:number,
		y?:number,
		z?:number,
		zlayer?:number,

		gw?:number,
		gh?:number,
		gx?:number,
		gy?:number,

		index?: number, // index (e.g. for tab groups)

		margin?:number
		margin_top?:number
		margin_bottom?:number
		margin_left?:number
		margin_right?:number

		dynamic_size?:boolean // size fit content, works in FlexGroup or DragGroup
		resizable?:boolean // user can manually resize
		draggable?:boolean // user can move the component

	}
}