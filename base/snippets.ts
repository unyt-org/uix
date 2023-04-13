// Snippets (generate predefined HTML)

import { Datex } from "unyt_core";
import { I } from "../uix_short.ts";
import { Res } from "./res.ts";
import { UnytPenPad } from "./unyt_pen.ts";
import { HTMLUtils } from "../html/utils.ts";

export namespace Snippets {

	/** creates list item div (like context menu items) */
	export function ListItem(text:Datex.CompatValue<string>, icon:string, extra?:string|UnytPenPad, has_sub_menu:boolean = false, disabled:boolean = false) {
		const el = HTMLUtils.createHTMLElement(`<div class="contextmenu-item ${disabled ? "disabled" :""} ${has_sub_menu ? " sub_menu_header": ""}">
			<div style="padding-left:0.4em; display:inline-block;opacity:0.5;width:1.6em">${icon ? I(icon) : ""}</div><span style="display:inline-block;"></span>
			<div class="contextmenu-extra" style="padding-right:0.4em; ${has_sub_menu ? "" : "opacity:0.3;"} text-align:right; min-width:50px; display:block;flex-grow:1">
				${has_sub_menu ? I`fa-chevron-right` : (typeof extra == "string" ? Res.getShortcutFormatted(extra) : "")}
			</div> 
		</div>`);

		HTMLUtils.setElementText(<HTMLSpanElement>el.children[1], text)
		
		// add unyt pen  pad
		if (extra instanceof UnytPenPad) {
			const html = extra.getHTMLElement();
			HTMLUtils.setCSS(html, {float:'right', height:'18px', 'margin-top':'2px'});
		
			el.querySelector(".contextmenu-extra").append(html);
		}

		return el;
	}

	/** creates a header element with title and functions */
	export function Header(title?:string, title_color?:string, left_elements?:HTMLElement[], right_elements?:HTMLElement[], expanded_elements?:HTMLElement[], absolute=false, margin_top?:string, margin_bottom:string="10px", expanded = false):{header:HTMLElement,title_el:HTMLElement,top_element:HTMLElement,expanded_element:HTMLElement} {
		let header = HTMLUtils.createHTMLElement(`<div style="position:relative;margin-bottom:${margin_bottom};align-items:center;width:100%"></div>`)

		let left_element  = HTMLUtils.createHTMLElement(`<div style="margin-right:10px;flex-grow:1; display: flex;justify-content: flex-start;white-space:nowrap;"></div>`);
		let right_element = HTMLUtils.createHTMLElement(`<div style="flex-grow:1; display: flex;justify-content: flex-end;white-space:nowrap;"></div>`);
		let top_element = HTMLUtils.createHTMLElement(`<div style="display:flex;flex-wrap: wrap;margin-bottom:10px;align-items:center;width:100%"></div>`)
		
		let expanded_element = HTMLUtils.createHTMLElement(`<div class="expand" style="flex-grow:1; display: flex;justify-content: flex-start;align-items:center;white-space:nowrap;margin-left:30px;"></div>`);
		
		// display top_element absolute on top of parent
		if (absolute) {
			header.style.display = "inline"
			HTMLUtils.setCSS(top_element, {
				position: "absolute",
				'z-index': "1",
				'pointer-events': "none"
			})        
			if (margin_top) {
				top_element.style.marginTop = margin_top;
			}
		}
		else {
			HTMLUtils.setCSS(header, {
				display: "flex",
				'flex-wrap': "wrap",
				'padding-bottom': "5px;",
				'border-bottom': "2px solid #dddddd08"
			})
			if (margin_top) {
				header.style.marginTop = margin_top;
			}
		}

		let title_el:HTMLElement;
		if (title!=null) {
			title_el = HTMLUtils.createHTMLElement(`<h3 style="margin:0px;${title_color?"color:"+title_color:""}">${title}</h3>`);
			left_element.append(title_el) // first add title left
		}

		for (let e=0;e<left_elements?.length??0;e++) {
			left_element.append(left_elements[e])
			if (e<left_elements.length-1) left_element.insertAdjacentHTML('beforeend', `<div style='width:8px'></div>`) // space between
			if (absolute) left_elements[e].style.pointerEvents = "all" // re-enable pointer events
		}

		for (let e=0;e<right_elements?.length??0;e++) {
			right_element.append(right_elements[e])
			if (e<right_elements.length-1) right_element.insertAdjacentHTML('beforeend', `<div style='width:8px'></div>`) // space between
			if (absolute) right_elements[e].style.pointerEvents = "all" // re-enable pointer events
		}

		for (let e=0;e<expanded_elements?.length??0;e++) {
			expanded_element.append(expanded_elements[e])
			if (e<expanded_elements.length-1) expanded_element.insertAdjacentHTML('beforeend', `<div style='width:8px'></div>`) // space between
		}

		let expand = ()=>{
			expanded_element.classList.add("expanded")
			if (absolute) header.style.borderBottom = "2px solid #dddddd08"             // add border
			if (absolute && margin_top) expanded_element.style.marginTop = margin_top;     // adjust margins
			if (absolute) expanded_element.style.marginBottom = '10px'            // adjust margin
		}
		let collapse = ()=>{
			expanded_element.classList.remove("expanded")
			if (absolute) header.style.borderBottom = "none"                 // reset border
			if (absolute && margin_top) expanded_element.style.marginTop = "0";    // reset margin to 0
			if (absolute) expanded_element.style.marginBottom = "0"           // reset margin to 0

		}

		top_element.append(left_element);
		top_element.append(right_element);
		header.append(top_element)
		header.append(expanded_element);

		// listen to child events
		let expand_toggles = header.querySelectorAll('[data-action="toggle-expand"]');
		if (expanded) expand(); // expand per default?

		expand_toggles.forEach(t=>t.addEventListener("mousedown", ()=>{
			if (!expanded) expand()
			else collapse();
			expanded = !expanded;
		}))

		return {header, title_el, top_element, expanded_element};
	}
	
}