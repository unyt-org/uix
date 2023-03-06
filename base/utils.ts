// deno-lint-ignore-file no-namespace

// Utils

import { Datex, decimal, pointer } from "unyt_core";
import { Types } from "../utils/global_types.ts";
import { Components } from "../components/main.ts"
import { Resource } from "../utils/resources.ts";
import { I, S } from "../uix_short.ts";
import { Theme } from "./theme.ts";
import { UnytPen } from "./unyt_pen.ts";
import { Files } from "./files.ts";
import { abstract_component_classes, component_classes, component_groups } from "../utils/global_values.ts";
import { DX_VALUE } from "unyt_core/datex_all.ts";

export namespace Utils {

	let id_counter = 0;

	export function getUniqueElementId(prefix = 'uix_uuid_'){
		return prefix + Math.round(Math.random()*1000000) + '' + Date.now() + id_counter++;
	}

	// change brightness of hex color
	export function lightenDarkenColor(col:`#${string}`, amt:number) {
		let usePound = false;


		if (col==undefined) return "#f00"; // invalid

		if (col[0] == "#") {
			col = col.slice(1);
			usePound = true;
		}
		const num = parseInt(col.slice(0,6), 16);
		let r = (num >> 16) + amt;
		if (r > 255) {
			r = 255;
		} else if (r < 0) {
			r = 0;
		}
		let b = ((num >> 8) & 0x00FF) + amt;
		if (b > 255) {
			b = 255;
		} else if (b < 0) {
			b = 0;
		}
		let g = (num & 0x0000FF) + amt;
		if (g > 255) {
			g = 255;
		} else if (g < 0) {
			g = 0;
		}

		return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6,"0");
	}

	// add alpha to hex color (0-255)
	export function addAlphaToColor(col:`#${string}`, amt:number) {

		if (col==undefined) return "#f00"; // invalid

		if (col.length == 9) col = col.slice(0,7);
		return col + amt.toString(16).padStart(2,'0');
	}
	
	// Color conversios

	// 0xffffff -> '#ffffff'
	export function intToHex(number:number|bigint):`#${string}` {
		return `#${Math.floor(Number(number)).toString(16).padStart(6, '0')}`;
	}

	export function getBrightnessFromColor(color:`#${string}`|number|bigint):number {                
		let rgb:[number,number,number]
		if (typeof color == "string") rgb = this.hexToRgb(color);
		else rgb = this.intToRgb(color);

		let hsl = this.rgbToHsl(...rgb);
		return hsl[2];
	}

	export function hexToRgb(hex:`#${string}`):[number, number, number] {
		const r = parseInt(hex.slice(1, 3), 16)
		const g = parseInt(hex.slice(3, 5), 16)
		const b = parseInt(hex.slice(5, 7), 16)
		return [r, g, b]
	}

	export function rgbToHex(r:number, g:number, b:number):`#${string}` {
		let r_string = r.toString(16);
		let g_string = g.toString(16);
		let b_string = b.toString(16);
		
		if (r_string.length == 1) r_string = "0" + r_string;
		if (g_string.length == 1) g_string = "0" + g_string;
		if (b_string.length == 1) b_string = "0" + b_string;

		return <`#${string}`> ("#" + r_string + g_string + b_string);
	}

	export function intToRgb(color:number|bigint):[number, number, number] {
		color = globalThis.Number(color);
		const r = (color & 0xFF0000) >> 16;
		const g = (color & 0x00FF00) >> 8;
		const b = (color & 0x0000FF);
		return [r,g,b];
	}

	export function rgbToInt(r:number, g:number, b:number) {
		return (r << 16) | (g << 8) | b;
	}

	export function rgbToHsl(r:number, g:number, b:number):[number, number, number] {
		r /= 255, g /= 255, b /= 255;
		
		let max = Math.max(r, g, b), min = Math.min(r, g, b);
		let h, s, l = (max + min) / 2;
		if (max == min) h = s = 0; 
		else {
			let d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch (max) {
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}
		return [h, s, l];
	}

	// h:0..1, s:0..1, l:0..1
	export function hslToRgb(h:number, s:number, l:number):[number, number, number] {
		h *= 360;
		const k = n => (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const f = n =>
			l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
		return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
	}


	// handle Element creator functions
	const ELEMENT_CREATORS = new Map<string, Types.element_creator>();

	export function getElementCreatorById(id: string): Types.element_creator {
		return ELEMENT_CREATORS.get(id);
	}

	// TODO this method should be called perhaps somwhere??!?!
	export function removeElementCreator(id: string) {
		return ELEMENT_CREATORS.delete(id);
	}

	function _addElementCreator(id: string, creator:Types.element_creator) {
		return ELEMENT_CREATORS.set(id, creator);
	}

	/** use this method to generate the drop data necessary to initiate an element creation */
	export function createElementCreator<D>(data:D, get:(data:D)=>Promise<Components.Base>, getAll?:(data:D)=>Promise<Components.Base[]>, type:"single"|"multiple"="single") {
		let id = "c-" + Date.now() + "-" + Math.round(Math.random()*10000);
		ELEMENT_CREATORS.set(id, {type:type, get:get, getAll:getAll});
		return {creator_id:id, data:data};
	}


	export function createDefaultOnDrop(element: Components.Base):Types.drop_handler {
		return {drop: async (drop_event)=>{  // drop event
				if (drop_event.types.has(Types.DRAGGABLE.ELEMENT_CREATOR)) {
					let data = drop_event.data[Types.DRAGGABLE.ELEMENT_CREATOR];

					let placeholder:Components.Base = new Components.TabGroup();
					if (data.type=="multiple") element.replaceWith(placeholder); // TODO better placeholder element?
					else placeholder = element;

					let drop_el = await (data.get());
					if (drop_el) placeholder.replaceWith(drop_el);
				}

				else if (drop_event.types.has(Types.DRAGGABLE.ELEMENT)) {
					let el = drop_event.data[Types.DRAGGABLE.ELEMENT];
					if (el) element.replaceWith(el);
				}

					// else if (drop_event.types.has(Types.DRAGGABLE.TREE_ITEM)) {
					//     let entry = <tree_entry>drop_event.data[Types.DRAGGABLE.TREE_ITEM];
					//     let path = entry.path
					//     let children:tree_entry[] = entry.children
					//     if (children) {
					//         let tab_group = await element.replaceWith(TabGroup, {editable: true, header_location: "top"});
					//         for (let child of children) {
					//             if (child.type!="dir") await tab_group.addFileTab(child.path);
					//         }
					//     }
					//     else {
					//         element.replaceWith(await createFileElement(path, {
					//             start_vertex:element.options.start_vertex,
					//             end_vertex:element.options.end_vertex,
					//             background:element.options.background,
					//             margin:element.options.margin,
					//             margin_bottom:element.options.margin_bottom,
					//             margin_top:element.options.margin_top,
					//             margin_left:element.options.margin_left,
					//             margin_right:element.options.margin_right,
					//         }));
					//     }
				// }

				else if (drop_event.types.has(Types.DRAGGABLE.URL)) {
					element.replaceWith(new Components.Webpage({url: drop_event.data[Types.DRAGGABLE.URL]}));
				}
			}}
	}

	export function unytPenContextMenuItem(value: any) {

		return {
			text:S`unyt_pen_context_menu`, 
			shortcut:"unyt_pen_read", 
			get_pad: () => UnytPen.generateDataPad(value),
			//icon?:string, 
			handler:() => {},
			//el:JQuery, 
			close_ctx:(delete_container?:boolean)=>{}
		}
	}


	const custom_entry_icons = new Map<string,string>();
	const custom_entry_colors = new Map<string,string>();

	export function registerEntryType(entry_type: string, color:string, icon:string) {
		custom_entry_icons.set(entry_type, icon);
		custom_entry_colors.set(entry_type, color);
	}

	
	export function getResourceIcon(resource: Resource) {
		if (custom_entry_icons.has(resource.meta.type)) return custom_entry_icons.get(resource.meta.type);

		else if (resource.meta.type=="espruino") return I `far-folder`
		else if (resource.meta.type=="project_dir") return I `far-folder`
		else if (resource.meta.linked && resource.is_directory) return I `fa-folder`
		else if (resource.is_directory) return I `fa-folder`

		// default file
		else {
			let ext = resource.path?.substring(resource.path.lastIndexOf('.') + 1);
			if (Files.file_icons.has(ext)) return Files.file_icons.get(ext)
			// default
			else return I `fa-file`
		}

	}

	export function getResourceColor(resource: Resource) {
		if (custom_entry_colors.has(resource.meta.type)) return custom_entry_colors.get(resource.meta.type);

		if (resource.meta.linked && (resource.is_directory)) return '#d5d5d5';
		else if (resource.is_directory) {
			if (resource.name.startsWith(".")) return 'rgba(79, 169, 232, 0.5)'
			else return 'var(--accent)'
		}
		else if (resource.meta.type=="espruino") return 'var(--accent)'

		// default file
		else return 'var(--text)'
	}



	export function getElementAddItems(handle_parent_element_or_handler:Components.Group|((element:Types.ComponentSubClass)=>void)){
		let items:Types.context_menu = []

		let grouped = new Set<Types.ComponentSubClass>();

		for (let [group_name, elements] of component_groups) {
			let group = {
				text: group_name,
				sub_menu: []
			}
			for (let element of elements) {
				if (abstract_component_classes.has(element)) continue; // dont list abstract elements
				grouped.add(element);
				group.sub_menu.push({
					text: element.name,
					icon: element.DEFAULT_OPTIONS.icon,
					handler: (x:number,y:number)=>{
						if (handle_parent_element_or_handler instanceof Function) handle_parent_element_or_handler(element);
						else handle_parent_element_or_handler.handleChildInsert(new element(),x,y)
					}
				})
			}
			items.push(group);
		}


		for (let [type, value] of component_classes) {
			if (abstract_component_classes.has(value) || grouped.has(value)) continue; // dont list abstract elements or grouped elements
			items.push({
				text: value.name,
				icon: value.DEFAULT_OPTIONS.icon?.toString(),
				handler: (x:number,y:number)=>{
					if (handle_parent_element_or_handler instanceof Function) handle_parent_element_or_handler(value);
					else handle_parent_element_or_handler.handleChildInsert(new value(),x,y)
				}
			})
		}

		return items.sort((a, b) => {
			// @ts-ignore
			if (a.sub_menu) return 1;
			if (typeof a != "object" || typeof b != "object") return 0;
			let keyA = a.text.toString().toUpperCase();
			let keyB = b.text.toString().toUpperCase();
			if (keyA < keyB) return -1;
			if (keyA > keyB) return 1;
			return 0;
		});
	}


	// @deprecated - use UIX.Clipboard
	export async function getClipboardData():Promise<{types:Set<Types.DRAGGABLE>, data:Types.draggable_data}> {
		// @ts-ignore
		let items = navigator.clipboard?.read ? await navigator.clipboard.read() : (
			// fake text/plain item, if only readText supported
			navigator.clipboard?.readText ? [{getType:()=>{return {text:()=>navigator.clipboard?.readText()}}, types:['text/plain']}] : null
		);

		let res = {types:new Set<Types.DRAGGABLE>(), data:{}};

		for (let clipboardItem of items??[]) {
			for (let type of clipboardItem.types) {
				let blob = await clipboardItem.getType(type);
				if (type == "text/plain") {
					let path = await blob.text();
					if (true/*TODO check if path exists*/) {
						res.types.add(Types.DRAGGABLE.TREE_ITEM);
						res.data[Types.DRAGGABLE.TREE_ITEM] = path;
					}
				}
				else {
					console.log(type, blob)
				}
				// we can now use blob here
			}
		}
		return res;
	}


	export function writeFileToClipboard(file_name:string, file_content) {
		let data = [
			// @ts-ignore
			// new ClipboardItem({ "text/html": new Blob([file_name], { type: "text/html" }) }),
			// @ts-ignore
			new ClipboardItem({ "text/plain": new Blob([file_name], { type: "text/plain" })})];

		// @ts-ignore
		navigator.clipboard.write(data)
	}

	export function writeTextToClipboard(text:string) {
		// @ts-ignore
		let data = [new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" })})];
		// @ts-ignore
		navigator.clipboard.write(data)
	}

	
  

}