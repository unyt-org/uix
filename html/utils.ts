import "unyt_core";
import { DX_VALUE } from "unyt_core/datex_all.ts";
import { Datex, decimal, pointer } from "unyt_core";
import { Theme } from "../base/theme.ts";
import { defaultElementAttributes, elementEventHandlerAttributes, elementAttributes } from "./attributes.ts";


// deno-lint-ignore no-namespace
export namespace HTMLUtils {

	export function escapeHtml(str:string) {
		if (typeof str != "string") return "";
		return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replaceAll('"', '&quot;').replaceAll("'", '&#039;');
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
	export function setCSS<T extends HTMLElement>(element:T, style:Datex.CompatValue<string>):T
	export function setCSS<T extends HTMLElement>(element:T, properties_object_or_property:{[property:string]:Datex.CompatValue<string|number>}|Datex.CompatValue<string>, value?:Datex.CompatValue<string|number>):T {
		let properties:{[property:string]:Datex.CompatValue<string|number|undefined>};
		if (typeof properties_object_or_property == "string" && value != undefined) properties = {[properties_object_or_property]:value};
		else if (typeof properties_object_or_property == "string" || (properties_object_or_property instanceof Datex.Value && Datex.Type.ofValue(properties_object_or_property) == Datex.Type.std.text)) {
			setElementAttribute(element, "style", properties_object_or_property)
			return element;
		}
		else properties = Datex.Value.collapseValue(properties_object_or_property,true,true) as {[property:string]:Datex.CompatValue<string|number|undefined>};

		for (const [property, value] of Object.entries(properties)) {
			setCSSProperty(element, property, value);
		}
		return element;
	}

	// set css property, updated if DatexValue
	export function setCSSProperty<T extends HTMLElement>(element:T, property:string, value:Datex.CompatValue<string|number|undefined>):T{

		// convert camelCase to kebab-case
		property = property?.replace(/[A-Z]/g, x => `-${x.toLowerCase()}`);

		// none
		if (value == undefined) {
			if (element.style.removeProperty) element.style.removeProperty(property);
			// @ts-ignore style property access
			else delete element.style[property];
		}

		// UIX color
		else if (value instanceof Datex.PointerProperty && value.pointer.val == Theme.colors) {
			if (element.style.setProperty) element.style.setProperty(property, `var(--${value.key})`); // autmatically updated css variable
			// @ts-ignore style property access
			else element.style[property] = `var(--${value.key})`
		}
		// other Datex CompatValue
		else {
			Datex.Value.observeAndInit(value, (v,k,t) => {
				if (v == undefined) {
					if (element.style.removeProperty) element.style.removeProperty(property);
					// @ts-ignore style property access
					else delete element.style[property];
				}
				else {
					if (element.style.setProperty) element.style.setProperty(property, getCSSProperty(<string>v))
					// @ts-ignore style property access
					else element.style[property] = getCSSProperty(v);
				}
			}, undefined, undefined);
		}
		return element;
	}

	export function getTextNode(content:any) {
		const textNode = document.createTextNode("");
		// @ts-ignore DX_VALUE
		textNode[DX_VALUE] = content;

		Datex.Value.observeAndInit(content, (v,k,t) => {
			textNode.textContent = v!=undefined ? (<any>v).toString() : ''
		}, undefined, undefined);

		return textNode;
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
	export function getCSSProperty(value:Datex.CompatValue<number|string>, use_css_variables = true):string {
		// UIX color value
		if (use_css_variables && value instanceof Datex.PointerProperty && value.pointer.val == Theme.colors) {
			value = `var(--${value.key})`; // autmatically updated css variable
		}

		// number value to px
		if (typeof value == "number") return value.toString() + "px";

		else if (use_css_variables) return value?.toString() ?? '';
		// try to collapse value
		else if (value!=undefined) {
			// css variable
			if (value.toString().startsWith('var(--')) return getComputedStyle(document.documentElement).getPropertyValue(value?.toString().replace('var(','').replace(')','')).trim();
			// css color name
			else if (!value.toString().startsWith("#")) return color_names[<keyof typeof color_names>value.toString().toLowerCase()] ?? ''
			// normal string value
			else return value.toString()
		}
		else return '';
	}

	// convert DatexCompatValue to css property
	export function getElementSize(element:HTMLElement, dimension:'x'|'y'): Datex.Value<number>
	export function getElementSize(element:HTMLElement): Datex.Value<{x:number, y:number}>
	export function getElementSize(element:HTMLElement, dimension?:'x'|'y'): Datex.Value<number> | Datex.Value<{x:number, y:number}>{
		const value = dimension ? decimal() : pointer({x:0,y:0}); 
		if (!globalThis.Deno) {
			const resizeObserver = new ResizeObserver((entries) => {
				const size = entries[0].borderBoxSize?.[0] ?? entries[0].contentBoxSize?.[0] ?? {inlineSize:entries[0].contentRect.width,blockSize:entries[0].contentRect.height};
				if (value instanceof Datex.DecimalRef) value.val = size[dimension == 'x' ? 'inlineSize' : 'blockSize']
				else {
					value.x = size.inlineSize;
					value.y = size.blockSize;
				}
			})
			resizeObserver.observe(element);
		}
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

	function formatAttributeValue(val:any, root_path?:string|URL): string {
		if (root_path==undefined) return val?.toString?.()  ?? ""
		else if (typeof val == "string" && (val.startsWith("./") || val.startsWith("../"))) return new URL(val, root_path).toString();
		else return val?.toString?.() ?? ""
	}

	export const EVENT_LISTENERS: unique symbol = Symbol("EVENT_LISTENERS");
	export type elWithEventListeners = HTMLElement & {[EVENT_LISTENERS]:Map<keyof HTMLElementEventMap, Set<Function>>}

	function setAttribute(element: HTMLElement, property:string, val:unknown, root_path?:string|URL) {
		// not an HTML attribute - set property
		if (!(
			property.startsWith("data-") ||
			property.startsWith("aria-") ||
			defaultElementAttributes.includes(<typeof defaultElementAttributes[number]>property) || 
			elementEventHandlerAttributes.includes(<typeof elementEventHandlerAttributes[number]>property) ||
			(<readonly string[]>elementAttributes[<keyof typeof elementAttributes>element.tagName.toLowerCase()])?.includes(<typeof elementAttributes[keyof typeof elementAttributes][number]>property))) {
				// @ts-ignore element property name
				element[property] = Datex.Value.collapseValue(val, true, true);
			return;
		}

		// normal attribute
		if (val === false) element.removeAttribute(property);
		else if (val === true || val === undefined) element.setAttribute(property,"");
		else if (typeof val == "function") {
			if (property.startsWith("on")) {
				const eventName = <keyof HTMLElementEventMap>property.replace("on","").toLowerCase();
				element.addEventListener(eventName, <any>val);
				// save in [EVENT_LISTENERS]
				if (!(<elWithEventListeners>element)[EVENT_LISTENERS]) (<elWithEventListeners>element)[EVENT_LISTENERS] = new Map<keyof HTMLElementEventMap, Set<Function>>().setAutoDefault(Set);
				(<elWithEventListeners>element)[EVENT_LISTENERS].getAuto(eventName).add(val);
			}
			else throw new Error("Cannot set event listener for element attribute '"+property+"'")
		}
		else element.setAttribute(property, formatAttributeValue(val,root_path));
	}

	export function setElementAttribute<T extends HTMLElement>(element:T, property:string, value:Datex.CompatValue<any>|Function, root_path?:string|URL) {
		if (!element) return;
	
		// DatexValue
		if (value instanceof Datex.Value) {
			setAttribute(element, property, value.val, root_path)
			value.observe(v => setAttribute(element, property, v, root_path));
		}
		// default
		else setAttribute(element, property, value, root_path)
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
			this.innerHTML = (text.getHTML() as HTMLElement).children[0].innerHTML;
		}
		// @ts-ignore _use_markdown
		else if (this._use_markdown && typeof text == "string") {
			this.innerHTML = (new Datex.Markdown(text).getHTML() as HTMLElement).children[0].innerHTML;
		}
		else this.innerText = ((<any>text)?.toString()) ?? ''
	}

	export function setElementHTML<T extends HTMLElement>(element:T, html:Datex.CompatValue<string|HTMLElement>):T {
		// unobserve?
		element_bound_html_values.get(element)?.unobserve(element);
		element_bound_text_values.get(element)?.unobserve(element);

		// none
		if (html == undefined) element.innerHTML = '';

		// DatexValue
		if (html instanceof Datex.Value) {
			updateElementHTML.call(element, html.val);

			// @ts-ignore: TODO: fix?
			html.observe(updateElementHTML, element);
			element_bound_html_values.set(element, html);
		}
		// default
		else updateElementHTML.call(element, html);

		return element;
	}

	export function setElementText<T extends HTMLElement>(element:T, text:Datex.CompatValue<unknown>, markdown = false):T{
		// unobserve?
		element_bound_html_values.get(element)?.unobserve(element);
		element_bound_text_values.get(element)?.unobserve(element);
		
		// @ts-ignore markdown flag
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

	// append an element or text to an element
	export function append<T extends HTMLElement|DocumentFragment>(element:T, content:Datex.CompatValue<Element|DocumentFragment|string|number|bigint|boolean>):T {
		if (content instanceof Node) element.append(content);
		else if (typeof content == "string" || typeof content == "number" || typeof content == "boolean" || typeof content == "bigint") element.append(content.toString());
		else {
			element.append(getTextNode(content));
		}
		return element;
	}


	// jquery-like event listener (multiple events at once)
	export function addEventListener<E extends HTMLElement>(target:E, events:string, listener: (this: HTMLElement, ev: Event) => any, options?: boolean | AddEventListenerOptions){
		for (const event of events.split(" ")){
			target.addEventListener(event.trim(), listener, options);
		}
	}
	export function removeEventListener<E extends HTMLElement>(target:E, events:string, listener: (this: HTMLElement, ev: Event) => any, options?: boolean | AddEventListenerOptions){
		for (const event of events.split(" ")){
			target.removeEventListener(event.trim(), listener, options);
		}
	}


	// jquery-like event listener (multiple events at once + delegate with query selector)
	export function addDelegatedEventListener<E extends HTMLElement>(target:E, events:string, selector:string,  listener: (this: HTMLElement, ev: Event) => any, options?: boolean | AddEventListenerOptions){
		for (const event of events.split(" ")){
			target.addEventListener(event.trim(), function (event) {
				if (event.target && event.target instanceof HTMLElement && event.target.closest(selector)) {
					listener.call(event.target, event)
				}
			}, options);
		}
	}

}