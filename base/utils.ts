// deno-lint-ignore-file no-namespace

// Utils

import { Datex, decimal, pointer } from "unyt_core";
import { Types } from "../utils/global_types.ts";
import { Components } from "../components/main.ts"
import { Resource } from "../utils/resources.ts";
import { Actions } from "./actions.ts";
import { Snippets } from "./snippets.ts";
import { I, S } from "../uix_short.ts";
import { Theme } from "./theme.ts";
import { UnytPen } from "./unyt_pen.ts";
import { Files } from "./files.ts";
import { abstract_component_classes, component_classes, component_groups } from "../utils/global_values.ts";
import { document, window } from "../utils/constants.ts";

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
	
	export function escapeHtml(str:string) {
		if (typeof str != "string") return "";
		return str.replace(/&/g, "&amp;").replace(/ /g, "&nbsp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

	// create HTMLElement from string
	export function createHTMLElement(html?:string, content?:Datex.CompatValue<unknown|HTMLElement>|(Datex.CompatValue<unknown|HTMLElement>)[]):HTMLElement {
		if (html == undefined) html = "<div></div>";
		const template = document.createElement('template');
		html = html.trim();
		template.innerHTML = html;
		const element = <HTMLElement>template.content.firstChild;
		if (content != undefined) {
			// set html
			if (Datex.Value.collapseValue(content,true,true) instanceof window.HTMLElement) setElementHTML(element, <HTMLElement>content);
			// set child nodes
			if (content instanceof Array) {
				for (const el of content){
					if (Datex.Value.collapseValue(el,true,true) instanceof window.HTMLElement) element.append(el)
					else {
						const container = document.createElement("div");
						setElementText(container, el);
						element.append(container);
					}
				}
			}
			// set text
			else setElementText(element, content);
		}
		return element;
	}

	export function setCSS<T extends HTMLElement>(element:T, property:string, value?:Datex.CompatValue<string|number>):T
	export function setCSS<T extends HTMLElement>(element:T, properties:{[property:string]:Datex.CompatValue<string|number>}):T
	export function setCSS<T extends HTMLElement>(element:T, properties_object_or_property:{[property:string]:Datex.CompatValue<string|number>}|string, value?:Datex.CompatValue<string|number>):T {
		let properties:{[property:string]:Datex.CompatValue<string|number>};
		if (typeof properties_object_or_property == "string") properties = {[properties_object_or_property]:value};
		else properties = properties_object_or_property;

		for (const [property, value] of Object.entries(properties)) {
			Utils.setCSSProperty(element, property, value);
		}
		return element;
	}

	// set css property, updated if DatexValue
	export function setCSSProperty<T extends HTMLElement>(element:T, property:string, value:Datex.CompatValue<any>):T{

		// convert camelCase to kebab-case
		property = property?.replace(/[A-Z]/g, x => `-${x.toLowerCase()}`);

		// none
		if (value == undefined) element.style.removeProperty(property);


		// UIX color
		else if (value instanceof Datex.PointerProperty && value.pointer.val == Theme.colors) {
			element.style.setProperty(property, `var(--${value.key})`); // autmatically updated css variable
		}
		// other Datex CompatValue
		else {
			Datex.Value.observeAndInit(value, (v,k,t) => {
				if (v == undefined) element.style.removeProperty(property);
				else element.style.setProperty(property, getCSSProperty(v))
			}, undefined, undefined);
		}
		return element;
	}
	

	const color_names = {"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
		"beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
		"cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
		"darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
		"darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
		"darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
		"firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
		"gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
		"honeydew":"#f0fff0","hotpink":"#ff69b4",
		"indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
		"lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
		"lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
		"lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
		"magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
		"mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
		"navajowhite":"#ffdead","navy":"#000080",
		"oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
		"palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
		"rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
		"saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
		"tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
		"violet":"#ee82ee",
		"wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
		"yellow":"#ffff00","yellowgreen":"#9acd32"
	};

	// convert DatexCompatValue to css property
	export function getCSSProperty(value:Datex.CompatValue<any>, use_css_variables = true):string {
		// UIX color value
		if (use_css_variables && value instanceof Datex.PointerProperty && value.pointer.val == Theme.colors) {
			value = `var(--${value.key})`; // autmatically updated css variable
		}

		if (use_css_variables) return value?.toString() ?? '';
		// try to collapse value
		else if (value) {
			// css variable
			if (value.toString().startsWith('var(--')) return getComputedStyle(document.documentElement).getPropertyValue(value?.toString().replace('var(','').replace(')','')).trim();
			// css color name
			else if (!value.toString().startsWith("#")) return color_names[value.toString().toLowerCase()] ?? ''
			// normal hex value
			else return value.toString()
		}
		else return '';
	}

	// convert DatexCompatValue to css property
	export function getElementSize(element:HTMLElement, dimension:'x'|'y'): Datex.Value<number>
	export function getElementSize(element:HTMLElement): Datex.Value<{x:number, y:number}>
	export function getElementSize(element:HTMLElement, dimension?:'x'|'y'): Datex.Value<number> | Datex.Value<{x:number, y:number}>{
		const value = dimension ? decimal() : pointer({x:0,y:0}); 
		const resizeObserver = new ResizeObserver((entries) => {
			const size = entries[0].borderBoxSize?.[0] ?? entries[0].contentBoxSize?.[0] ?? {inlineSize:entries[0].contentRect.width,blockSize:entries[0].contentRect.height};
			if (value instanceof Datex.DecimalRef) value.val = size[dimension == 'x' ? 'inlineSize' : 'blockSize']
			else {
				value.x = size.inlineSize;
				value.y = size.blockSize;
			}
		})
		resizeObserver.observe(element);
		return Datex.Pointer.pointerifyValue(value);
	}

	export function setCssClass<T extends HTMLElement>(element:T, classes:Datex.CompatValue<string[]>):T
	export function setCssClass<T extends HTMLElement>(element:T, ...classes:string[]):T
	export function setCssClass<T extends HTMLElement>(element:T, ...classes:(Datex.CompatValue<string[]>|string)[]):T {
		// DATEX class array
		if (classes[0] instanceof Array) {
			const class_list = classes[0];
			Datex.Value.observeAndInit(class_list, ()=>{
				// add new
				for (const c of class_list) {
					if (!element.classList.contains(c)) element.classList.add(c);
				}
				// remove old
				element.classList.forEach(c => {
					if (!class_list.includes(c)) element.classList.remove(c);
				})
			})
		}
		else {
			element.classList.add(...<string[]>classes)
		}
		return element;
	}

	export function setElementAttribute<T extends HTMLElement>(element:T, property:string, value:Datex.CompatValue<any>):T {
		if (!element) return;
		// none
		if (value == undefined) element.setAttribute(property, "");

		// DatexValue
		if (value instanceof Datex.Value) {
			element.setAttribute(property, value.val ?? "");
			value.observe( v => element.setAttribute(property, v ?? ""));
		}
		// default
		else element.setAttribute(property, value);
	}

	// remember which values are currently synced with element content - for unobserve
	const element_bound_html_values = new WeakMap<HTMLElement, Datex.Value>();
	const element_bound_text_values = new WeakMap<HTMLElement, Datex.Value>();

	function updateElementHTML(this:HTMLElement, html:HTMLElement|string){
		if (html instanceof HTMLElement) {
			this.innerHTML = '';
			this.append(html)
		} 
		else this.innerHTML = html ?? '';
	}

	function updateElementText(this:HTMLElement, text:unknown){
		if (this instanceof Datex.Value) console.warn("update text invalid", this, text)
		
		if (text instanceof Datex.Markdown) {
			this.innerHTML = text.getHTML().children[0].innerHTML;
		}
		else if (this._use_markdown && typeof text == "string") {
			this.innerHTML = new Datex.Markdown(text).getHTML().children[0].innerHTML;
		}
		else this.innerText = ((<any>text)?.toString()) ?? ''
	}

	export function setElementHTML<T extends HTMLElement>(element:T, html:Datex.CompatValue<string|HTMLElement>):T {
		if (!element) return;

		// unobserve?
		element_bound_html_values.get(element)?.unobserve(element);
		element_bound_text_values.get(element)?.unobserve(element);

		// none
		if (html == undefined) element.innerHTML = '';

		// DatexValue
		if (html instanceof Datex.Value) {
			updateElementHTML.call(element, html.val);

			html.observe(updateElementHTML, element);
			element_bound_html_values.set(element, html);
		}
		// default
		else updateElementHTML.call(element, html);

		return element;
	}

	export function setElementText<T extends HTMLElement>(element:T, text:Datex.CompatValue<unknown>, markdown = false):T{
		if (!element) return;

		// unobserve?
		element_bound_html_values.get(element)?.unobserve(element);
		element_bound_text_values.get(element)?.unobserve(element);
		
		// markdown flag
		element._use_markdown = markdown;

		// none
		if (text == undefined) element.innerText = '';

		// DatexValue
		else if (text instanceof Datex.Value) {
			updateElementText.call(element, text.val);

			text.observe(updateElementText, element);
			element_bound_text_values.set(element, text);
		}
		// default
		else updateElementText.call(element, text);

		return element;
	}


	// jquery-like event listener (multiple events at once)
	export function addEventListener<E extends HTMLElement>(target:E, events:string, listener: (this: HTMLElement, ev: Event) => any, options?: boolean | AddEventListenerOptions){
		for (let event of events.split(" ")){
			target.addEventListener(event.trim(), listener, options);
		}
	}
	export function removeEventListener<E extends HTMLElement>(target:E, events:string, listener: (this: HTMLElement, ev: Event) => any, options?: boolean | AddEventListenerOptions){
		for (let event of events.split(" ")){
			target.removeEventListener(event.trim(), listener, options);
		}
	}


	// jquery-like event listener (multiple events at once + delegate with query selector)
	export function addDelegatedEventListener<E extends HTMLElement>(target:E, events:string, selector:string,  listener: (this: HTMLElement, ev: Event) => any, options?: boolean | AddEventListenerOptions){
		for (let event of events.split(" ")){
			target.addEventListener(event.trim(), function (event) {
				if (event.target && event.target instanceof Element && event.target.closest(selector)) {
					listener.call(event.target, event)
				}
			}, options);
		}
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