import { Datex } from "unyt_core";
import { Components } from "../components/main.ts";
import { Resource } from "../utils/resources.ts";
import { Types } from "../utils/global_types.ts";
import { Utils } from "./utils.ts";
import { Res } from "./res.ts";
import { global_states, logger } from "../utils/global_values.ts";
import { IS_MOBILE_PORTRAIT } from "../utils/utils.ts";
import { Snippets } from "./snippets.ts";
import { I } from "../uix_short.ts"

function hideContextMenu() {
	document.querySelectorAll(".contextmenu-body").forEach(e=>e.classList.remove("animate"))
	document.querySelectorAll(".contextmenu-header").forEach(e=>e.classList.remove("animate"))
	document.querySelectorAll(".contextmenu-container").forEach(e=>e.classList.remove("animate"))
	document.querySelectorAll(".contextmenu-container").forEach(e=>e.remove())
}


function intersection<T> (...sets:Set<any>[]):Set<T> {
    if (sets.length == 0) return null;
    return sets.reduce(
        ( A, B) => {
            let X = new Set();
            B.forEach( (v => { if ( A.has(v) ) X.add(v) })) ;
            return X;
        } )
}


function getWindowScrollTop(){
	return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0 ;
}
function getWindowScrollLeft(){
	return window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0 ;
}


// Handlers
export namespace Handlers {

	// Drag and Drop
	let shifting_drag_element:Components.Base;
	let shifting_drag_element_original_pos: [number, number, number, number]
	let shift_hidden_elements = new Set<Components.Base>();
	
	// Handle Drag & Drop for any component
	
	function getDropData(e:DragEvent): {types:Set<Types.DRAGGABLE>, data:Types.draggable_data} {

		let data = e.dataTransfer;
		let res = {types:new Set<Types.DRAGGABLE>(), data:{}};

		// custom element creator
		if (data.types.includes(Types.DRAGGABLE.ELEMENT_CREATOR)) {
			let creator_data:any = data.getData(Types.DRAGGABLE.ELEMENT_CREATOR);
			if (creator_data) {
				res.types.add(Types.DRAGGABLE.ELEMENT_CREATOR)
				try {
					creator_data = JSON.parse(creator_data);
					let creator = Utils.getElementCreatorById(creator_data.creator_id);
					if (creator) {
						res.data[Types.DRAGGABLE.ELEMENT_CREATOR] = {
							type: creator.type,
							get: ()=>creator.get(creator_data.data),
							getAll: ()=>creator.getAll(creator_data.data)
						};
					}
				} catch (e) {
				}
			}
		}

		// element
		if (data.types.includes(Types.DRAGGABLE.ELEMENT)) {
			let element_pointer_id = data.getData(Types.DRAGGABLE.ELEMENT);
			let el = Datex.Pointer.get(element_pointer_id)?.val;
			res.types.add(Types.DRAGGABLE.ELEMENT)
			res.data[Types.DRAGGABLE.ELEMENT] = el;
		}

		// any text data
		if (data.types.includes("text/plain") || data.types.includes("text/plain") || data.types.includes("text/uri-list")) {
			let text_data = data.getData(Types.DRAGGABLE.TEXT);
			if (text_data.startsWith("https://workbench.unyt.org/")){
				let file_path = text_data.replace("https://workbench.unyt.org", "");
				if (file_path && true/*TODO check if path exists*/) {
					res.types.add(Types.DRAGGABLE.TREE_ITEM)
					res.data[Types.DRAGGABLE.TREE_ITEM] = file_path
				}
				else if (text_data.startsWith("https://") || text_data.startsWith("http://")) {
					res.types.add(Types.DRAGGABLE.URL)
					res.data[Types.DRAGGABLE.URL] = text_data
				}
				else {
					res.types.add(Types.DRAGGABLE.TEXT)
					res.data[Types.DRAGGABLE.TEXT] = text_data
				}
			}
			else {
				res.types.add(Types.DRAGGABLE.URL)
				res.data[Types.DRAGGABLE.URL] = text_data
			}
		}

		// internal tree (file) item
		if (data.types.includes(Types.DRAGGABLE.TREE_ITEM)) {
			let file_path = data.getData(Types.DRAGGABLE.TREE_ITEM);
			res.data[Types.DRAGGABLE.TREE_ITEM] = file_path
			res.types.add(Types.DRAGGABLE.TREE_ITEM)
		}

		// dragged file from outside
		if (data.items) {
			let files = []
			// Use DataTransferItemList interface to access the file(s)
			for (var i = 0; i < data.items.length; i++) {
				// If dropped items aren't files, reject them
				if (data.items[i].kind === 'file') {
					var file = data.items[i].getAsFile();
					files.push(file)
				}
			}
			if (files.length) {
				res.types.add(Types.DRAGGABLE.EXTERNAL_FILE);
				res.data[Types.DRAGGABLE.EXTERNAL_FILE] = files
			}

		}
		else {
			let files = []
			for (var i = 0; i < data.files.length; i++) {
				files.push(data.files[i])
			}
			if (files.length) {
				res.types.add(Types.DRAGGABLE.EXTERNAL_FILE);
				res.data[Types.DRAGGABLE.EXTERNAL_FILE] = files
			}
		}

		return res;
	}

	/**
	 * Creates a drop listener for a specific dom element
	 * @param element: an html element that handles drop events
	 * @param uix_element?: corresponding UIX element if available
	 * @param drop_handler: handler object handling drop, long_hover, in, out, ...
	 * @param add_border: add a 1px transparent border (set to false if the element already has a border)
	 * @param multi_area_drop: support for pressing shift and selecting multiple neighboring elements to drop to
	 * @param @experimental blur_area: blur the jquery element on dragover
	 */

	export function handleDrop(element:HTMLElement,  drop_handler: Types.drop_handler, uix_element?:Components.Base, add_border= false, multi_area_drop = false, blur_area = false) {

		if (add_border) element.classList.add("border-drag-area")
		element.style.boxSizing = "border-box";
		if (blur_area) element.classList.add("drag-invisible")

		let long_hover_fired = false;
		let drag_allowed = false;

		let added_class = false;
		let still_in = false;

		let enabled_shift_from_neighbor = false;

		element.addEventListener("dragover", async e=>{
			still_in = true;

			// shift from neighbor
			if (!enabled_shift_from_neighbor
				&& shifting_drag_element
				&& uix_element
				&& shifting_drag_element !== uix_element
				&& shifting_drag_element.parent == uix_element.parent) {

				//shifting_drag_element.updatePosition(shifting_drag_element.constraints.gx, uix_element.constraints.gy, uix_element.constraints.gw, uix_element.constraints.gh);

				uix_element.hide();
				shift_hidden_elements.add(uix_element);
				enabled_shift_from_neighbor = true;
				return;
			}

			// start shift
			if (!shifting_drag_element && uix_element && multi_area_drop && e.shiftKey) {
				shifting_drag_element = uix_element;
				shifting_drag_element_original_pos = [shifting_drag_element.constraints.gx, shifting_drag_element.constraints.gy, shifting_drag_element.constraints.gw, shifting_drag_element.constraints.gh];
				return;
			}

			if (!drag_allowed) {
				let data = getDropData(e);
				if ((drop_handler.allowed_types==undefined || (data.types && intersection(data.types, drop_handler.allowed_types).size)) && (drop_handler.drop_condition==undefined || drop_handler.drop_condition())) {
					drag_allowed = true;
					setTimeout(()=>drag_allowed = false, 2000);
				}
				else {
					element.classList.remove("drag-area")
					document.querySelectorAll(".blur-area").forEach(e=>e.remove())
					added_class = false;
				}
			}

			if (drag_allowed) {

				if (!added_class) {
					added_class = true
					document.querySelectorAll(".drag-area").forEach(e=>e.classList.remove("drag-area"))
					element.classList.add("drag-area")
					if (drop_handler.in) drop_handler.in(e)

					if (blur_area) {
						document.querySelectorAll(".blur-area").forEach(e=>e.remove())
						const rect = element.getBoundingClientRect();
						let width = rect.width;
						let height = rect.height;
						let top = rect.top;
						let left = rect.left;
						let border_radius = element.style.borderRadius;;
						document.body.insertAdjacentHTML('beforeend', `<div class="drag-area blur-area" style="backdrop-filter:blur(1.6px);border-radius:${border_radius};pointer-events:none;position:absolute;z-index:10000;width:${width}px;height:${height}px;top:${top}px;left:${left}px"></div>`)
					}
				}

				e.stopPropagation();
				e.preventDefault();
			}
		})

		element.addEventListener("dragleave", e=>{
			e.preventDefault();
			e.stopPropagation();
			still_in = false;

			setTimeout(()=>{
				if (!still_in) {
					long_hover_fired = false;
					element.classList.remove("drag-area")
					document.querySelectorAll(".blur-area").forEach(e=>e.remove())
					added_class = false;
					if (drop_handler.out) drop_handler.out(e)
				}
			}, 20)

		})

		element.addEventListener("dragenter", e=>{
			still_in = true;
		})


		if (drop_handler.long_hover) {
			// on hover 700ms
			let start_drag_over;
			element.addEventListener("dragenter", e=>{
				start_drag_over = Date.now();
			})

			element.addEventListener("dragover", e=>{
				if (drag_allowed && !long_hover_fired && Date.now() - start_drag_over > 700) {
					long_hover_fired = true;
					drop_handler.long_hover();
				}
			})
		}

		element.addEventListener("drop", async (e)=>{

			drag_allowed = false;

			if (!drop_handler.drop) return;

			if (element.classList.contains("drag-area")) {
				let res = getDropData(e);

				document.querySelectorAll(".drag-area").forEach(e=>e.classList.remove("drag-area"))
				document.querySelectorAll(".blur-area").forEach(e=>e.remove())
				added_class = false;
				await drop_handler.drop(res)

				e.preventDefault();
				e.stopPropagation();
			}

			// reset shifted neighbors
			for (let el of shift_hidden_elements) {
				shift_hidden_elements.delete(el)
				el.show();
			}

			// reset shift element
			if (shifting_drag_element) {
				// shifting_drag_element.updatePosition(...shifting_drag_element_original_pos);
				shifting_drag_element = null;
			}


		})

	}

	export function handleDrag(element:HTMLElement, drag_data: {}){

		element.addEventListener("dragstart", e => {
			let data = e.dataTransfer;
			data.effectAllowed = 'all';
			for (let [key, d] of Object.entries(drag_data)) {
				// smart stringifying
				if (key == Types.DRAGGABLE.ELEMENT && d instanceof Components.Base) data.setData(key, Datex.Pointer.getByValue(d).id);
				else if (key == Types.DRAGGABLE.TREE_ITEM && typeof d == "object") data.setData(key, (<Resource>d).path);
				else if (key == Types.DRAGGABLE.ELEMENT_CREATOR && typeof d == "object") data.setData(key, JSON.stringify(d));
				//else data.setData(key, d);
			}
		});
	}
	
	// Shortcuts
	export function handleShortcut(element:HTMLElement|Window, shortcut_name:string, handler:(x:number,y:number)=>void) {

		if (!handler || !element ) return;

		let shortcut_keys = Res.getShortcut(shortcut_name)?.split("+");

		if (!shortcut_keys) {
			logger.error("shortcut " + shortcut_name + " not found");
			return;
		}

		let alt = shortcut_keys.includes("alt");
		let cmd = shortcut_keys.includes("cmd");
		let ctrl = shortcut_keys.includes("ctrl");
		let shift = shortcut_keys.includes("shift");
		let key = shortcut_keys[shortcut_keys.length-1];

		let down = false;
		element.addEventListener("keydown", (e:KeyboardEvent) => {
			if (e.key?.toLowerCase() === key && (cmd === e.metaKey) && (ctrl === e.ctrlKey) && (shift === e.shiftKey) && (alt === e.altKey)) {
				if (!down) handler(global_states.mouse_x,global_states.mouse_y);
				down = true;
				e.preventDefault();
				e.stopPropagation()
			}
		})

		element.addEventListener("keyup", e => {
			down = false;
		})
	}
	
	// Tooltips

	export function showTooltip(content:string|HTMLElement, x:number, y:number, direction:'right'|'left'='right', tooltip_formatted = true) {
		let outer = document.createElement("div")
		let el = document.createElement("div");
		el.classList.add("tooltip");
		
		if (typeof content == "string") el.innerText = content
		else el.append(content)

		// remove default tooltip formatting (border, background)
		if (!tooltip_formatted) {
			el.style.padding = "0";
			el.style.background = "none";
			el.style.border = "none";
			el.style.borderRadius = "0";
		}


		outer.style.position = 'absolute';
		outer.style.zIndex = '1000000';
		outer.style.minHeight = '1.5em';
		outer.style.width = 'max-content';
		outer.append(el)
		document.body.append(outer);

		outer.style.top = (y-outer.getBoundingClientRect().height/2)+'px'; // adjust height to center_number

		if (direction == 'right') outer.style.left = x + 'px';
		else outer.style.left = (x-outer.getBoundingClientRect().width)+'px';

		let hidden = false;
		let hide = ()=>{
			if (hidden) return;
			hidden = true;
			el.classList.remove("animate")
			setTimeout(()=>outer.remove(), 200); 
		}

		el.classList.add("animate")
		

		return {hide}
	}


	// Contextmenu
	
	export function contextMenu(element:HTMLElement, items:Types.context_menu, header?:Types.context_menu_header, menu_container?:HTMLElement, trigger_events?:string[], is_primary_menu=true, primary_close?:(delete_container?: boolean) => void, primary_position?:{x:number,y:number}): [(e, hide_other:boolean)=>void, ()=>void] {

		const is_mobile = IS_MOBILE_PORTRAIT();

		let item_els:{[key:string]:HTMLElement} = {}; // local object saving all dom elements for the current context menu items

		menu_container = menu_container ?? Utils.createHTMLElement('<div class="contextmenu-container"></div>')
		let menu_body = Utils.createHTMLElement('<div class="contextmenu-body"></div>')
		let menu_header = Utils.createHTMLElement('<div class="contextmenu-header"></div>')

		menu_container.append(menu_header);
		menu_container.append(menu_body);

		menu_container.style.setProperty("display", "none")
		menu_body.style.setProperty("display", "none")
		menu_header.style.setProperty("display", "none")

		let first = true;

		// enable key shortcuts on load (even if context menu not opened)
		for (let item of Object.values(items)) {                
			// add key shortcut
			if (item !== "space" && item.shortcut) Handlers.handleShortcut(element, item.shortcut, item.handler);
		}

		const menu_position = {x:0, y:0};

		let start_time = 0;
		let active_child_ctx_item:Types.context_menu_item;


		// set listeners

		let listeners_set = false;
		const set_listeners = ()=>{
			// only add menu_container event listeners on first ctx menu, not again on child menus
			if (listeners_set || !is_primary_menu) return;
			listeners_set = true;

			menu_container.addEventListener("contextmenu", e=>{
				e.stopPropagation()
				e.preventDefault()
			});
			menu_body.addEventListener("contextmenu",  e=>{
				e.stopPropagation()
				e.preventDefault()
			});
			menu_header.addEventListener("contextmenu",  e=>{
				e.stopPropagation()
				e.preventDefault()
			});

			const hideContainer = e =>  {
				if (new Date().getTime()-start_time > 200) {
					close_ctx()
				}
			}

			menu_container.addEventListener("mouseup", hideContainer)
			menu_container.addEventListener("mouseleave", hideContainer)
		}


		// methods
		const close_child_ctx = ()=>{
			if (active_child_ctx_item && active_child_ctx_item!=="space") {
				active_child_ctx_item.close_ctx(false);
				active_child_ctx_item = null;
			}
		}

		const close_ctx = (hide_container=true) => {
			menu_header.classList.remove("animate");
			menu_body.classList.remove("animate");

			setTimeout(()=>{
				menu_header.style.setProperty("display", "none")
				menu_body.style.setProperty("display", "none")

				if (hide_container) menu_container.remove();

				// also close potential child context menu
				close_child_ctx();
				
			},is_mobile ? 200 : 0) // wait for down animation in mobile ctx menu

		}


		const generate = ()=>{
			for (let id of Object.keys(items)) {
				let item:Types.context_menu_item = items[id];
				
				// add horizontal ---------
				if (item === "space") {
					if (!first) menu_body.append(Utils.createHTMLElement('<div class="space"></div>'));
				}
				else  {
					item_els[id] = Snippets.ListItem(item.text, item.icon, item.get_pad?item.get_pad():item.shortcut, item.sub_menu!=null);
					menu_body.append(item_els[id])

					// add sub context menu
					if (item.sub_menu) {
						[item.trigger_ctx, item.close_ctx] = contextMenu(item_els[id], item.sub_menu, null, menu_container, undefined, false, primary_close ?? close_ctx, primary_position ?? menu_position)
					}
					first = false;
				}
			}
		}


		const trigger_ctx = (e:MouseEvent, hide_other:boolean=true, overrideX?:number, overrideY?:number)=>{
			e.stopPropagation();
			e.preventDefault();

			if (hide_other) hideContextMenu();

			if (first) generate();


			start_time = new Date().getTime();
			document.body.append(menu_container)


			menu_position.x = overrideX ?? e.clientX;
			menu_position.y = overrideY ?? e.clientY;

			// position at cursor position, if not mobile context menu
			if (!is_mobile) {
				// too low
				if (e.pageY - getWindowScrollTop() + 20 + menu_body.offsetHeight > window.innerHeight) {
					menu_position.y -= menu_body.offsetHeight + 10;
				}

				// too much to the right
				if (e.pageX - getWindowScrollLeft() + 20 + menu_body.offsetWidth > window.innerWidth) {
					menu_position.x -= menu_body.offsetWidth + 10;
				}

				if (menu_position.y<20) {
					menu_position.y = 20;
				}
				if (menu_position.x<20) {
					menu_position.x = 20;
				}
				if (menu_position.x+menu_body.offsetWidth>window.innerWidth) {
					menu_position.x = window.innerWidth-20-menu_body.offsetWidth;
				}
				menu_body.style.left = menu_position.x + "px";
				menu_body.style.top = menu_position.y + "px";
			}
			
			set_listeners();

			menu_container.style.display = "block"
			if (header) menu_header.style.display = "block"
			menu_body.style.display = "block"


			// menu_header.height() // fixes (bug?) - animate class not removed? - css gets animated?!?
			// menu.height() // fixes (bug?) - animate class not removed? - css gets animated?!?

			if (header) {
				menu_header.innerHTML = `<div style="color:${header.color ?? "var(--text_highlight)"};padding:1px"><div style="padding-left:0.4em; display:inline-block;${header.left ? 'width:0' :'width:1.6em'}">${header.icon ? I(header.icon) : ""}</div><span style="display:inline-block;">${header.title}</span></div>`;
				menu_header.style.display = "block";
				menu_header.style.minWidth = menu_body.offsetWidth + "px";
				menu_header.style.left = menu_position.x + "px";

				menu_header.style.top = (menu_position.y - menu_header.offsetHeight-15) + "px"
				menu_body.style.minWidth =  menu_header.offsetWidth + "px";
			}

			setTimeout(()=>{
				if (header) menu_header.classList.add("animate")
				menu_body.classList.add("animate")
			},0)
			
			// click handlers for context menu item
			for (let id of Object.keys(items)) {
				let item:Types.context_menu_item = items[id];
				if (item !== "space") {
					// update enabled/disabled state
					const disabled = item.disabled instanceof Function ? item.disabled() : item.disabled;
					
					if (disabled) item_els[id].classList.add("disabled")
					else item_els[id].classList.remove("disabled")

					if (!disabled && !item._handler_set) {
						item._handler_set = true;

						// handle click
						if (item.handler) {
							item._handler_set = true;
							item_els[id].addEventListener("mouseup", e => {
								(primary_close ?? close_ctx)()
								e.stopPropagation();
								// @ts-ignore
								item.handler(primary_position?.x ?? menu_position.x, primary_position?.y ?? menu_position.y);
							})
						}

						item_els[id].addEventListener("mouseenter", e => {
							if (active_child_ctx_item==item) return true

							close_child_ctx();

							// open sub context menu
							if (item !== "space" && item.trigger_ctx ) {
								const x = item_els[id].getBoundingClientRect().left + item_els[id].getBoundingClientRect().width + 2;
								const y = item_els[id].getBoundingClientRect().top;
								item.trigger_ctx(e, false, x, y);
								active_child_ctx_item = item;
							}
							return true
						})
					}
				}
			}
		}

		if (!trigger_events) trigger_events = ['contextmenu'];

		for (let trigger of trigger_events) {
			element.addEventListener(trigger, trigger_ctx);
		}

		return [trigger_ctx, close_ctx]
	}

	
}
