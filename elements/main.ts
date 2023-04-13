// deno-lint-ignore-file no-namespace
import { Datex, datex, decimal, text, transform } from "unyt_core";
import { Quantity, Time, Unit, unit, ValueError } from "unyt_core/datex_all.ts";
import { Element } from "../base/decorators.ts";
import { Utils } from "../base/utils.ts";
import { HTMLUtils } from "../html/utils.ts";
import { Theme } from "../base/theme.ts"
import { PLEEASE_FIREFOX } from "../uix_all.ts";
import { I } from "../uix_short.ts"
import {logger} from "../utils/global_values.ts";

// import "https://mozilla.github.io/pdf.js/build/pdf.js";


const HTMLElement = <typeof globalThis.HTMLElement>window.HTMLElement 

export namespace Elements {

	export namespace Base {
		export interface Options {
			css?: {[key:string]:string|number},
			
		}
	}

	// base class for all elements + components
	export class Base<O extends Elements.Base.Options = Elements.Base.Options> extends HTMLElement {

		protected options:O

		// true if server side rendered and component class is loaded later
		protected wasLoadedStatic = this.hasAttribute("data-static");

		constructor(options?:O) {
			super();

			// set options if not explicitely disabled
			if (options!==null) this.options = options ?? <O>{};

			if (this.options?.css) {
				this.css(this.options.css);
			}
		}
		
		// apply css properties to this element
		public css(property:string, value?:Datex.CompatValue<string|number>):this
		public css(properties:{[property:string]:Datex.CompatValue<string|number>}):this
		public css(properties_object_or_property:{[property:string]:Datex.CompatValue<string|number>}|string, value?:Datex.CompatValue<string|number>):this {
			if (typeof properties_object_or_property == "string") return HTMLUtils.setCSS(this, properties_object_or_property, value)
			else return HTMLUtils.setCSS(this, properties_object_or_property)
		}

		// add css classes
		public cssClass(classes:Datex.CompatValue<string[]>):this
		public cssClass(...classes:string[]):this
		public cssClass(...classes:(Datex.CompatValue<string[]>|string)[]):this {
			return HTMLUtils.setCssClass(this, ...<string[]>classes);
		}

	}



	export function getInputElementForValue<T=any>(value:Datex.CompatValue<T>, params:Record<string,unknown>):Elements.Base {


		if (Datex.Type.std.text.matches(value)) {
			return new Elements.TextInput(value, {...params});
		}

		else if (Datex.Type.std.integer.matches(value)) {
			return new Elements.IntegerInput(value, {show_carets:true, center_number:true, ...params});
		}

		else if (Datex.Type.std.decimal.matches(value)) {
			return new Elements.FloatInput(value, {show_carets:true, center_number:true, ...params});
		}

		else if (Datex.Type.std.boolean.matches(value)) {
			return new Elements.Checkbox({checked:value, ...params});
		}

		else if (Datex.Type.std.Array.matches(value) || Datex.Type.std.Set.matches(value)) {
			return new Elements.DropdownMenu(value, {...params});
		}

		else if (Datex.Type.std.time.matches(value)) {
			return new Elements.DateInput(value, {...params});
		}

		else if (Datex.Type.std.quantity.matches(value)) {
			return new Elements.QuantityInput(value, {show_carets:true, center_number:true, ...params});
		}

		else return new Elements.Text("??");

	}


	export type form_item<T=unknown> = {value:Datex.CompatValue<T>, label?:Datex.CompatValue<string>, options?:Iterable<string | [string, unknown]>, params?:Record<string,unknown>, input?:typeof ValueInput};

	@Element
	export class Form extends Base {

		constructor(items:form_item[]) {
			super();
			if (this.wasLoadedStatic) return;
			this.style.display = "table";
			this.style.borderSpacing = "3px";

			for (const item of items??[]) {
				const container = document.createElement("div");
				container.style.display = "table-row";

				const label = new Elements.Text(item.label).css({display:'table-cell', 'padding-right':'10px', 'white-space':'nowrap'});
				let input: Base;
				
				if (item.options) {
					input = new Elements.DropdownMenu(item.options, {selected_index:0, onChange: (i, v) => {
						if (item.value instanceof Datex.Value) item.value.val = v;
					}, ...(item.params??{}) })
				}

				else if (item.input) {
					// @ts-ignore instantiate child of abstract ValueInput class
					input = new item.input(item.value, item.params).css({display:'table-cell'});
				}

				else input = getInputElementForValue(item.value, item.params).css({display:'table-cell'})
				
				if (input instanceof Checkbox) input.css({direction:'rtl'});

				container.append(label)
				container.append(input)
				this.append(container)
			}

		}
	}

	export namespace Image {
		export interface Options extends Base.Options {
			src? : string
			image?: HTMLImageElement,
			glow?: boolean,
			animate?: boolean,
			description?: string,
			generate_placeholder?:boolean
			width?: number,
			height?: number,
			aspect?: number
		}
	}

	@Element
	export class Image extends Base<Image.Options> {
		constructor(options?: Image.Options) {
			super(options);
			if (this.wasLoadedStatic) return;

			let content:HTMLElement;
	
			if (this.options.image) {
				content = this.options.image;
				content.style.width = "100%"
			}

			else if (this.options.src) {
				content = document.createElement("img")
				content.src = this.options.src.toString();
				content.style.width = "100%"
			}

			else {
				content = document.createElement("div")
				content.style.display = "flex";
				content.style.justifyContent = "center";
				content.style.alignItems = "center";
				content.style.backgroundColor = "var(--bg_content_hlt)";
				content.style.width = "300px"
				content.style.aspectRatio = "1"

				content.innerHTML = I`fas-image`;

				// load generated placeholder image
				if (this.options.generate_placeholder) {
					if (!this.options.description) logger.error("Generate image placeholder without a description")
					else this.loadGeneratedImage()
				}
			}

			this.formatContent(content)
			this.append(content)

		}

		private async loadGeneratedImage(){
			console.log("placeholder: ", this.options.description?.toString());

			const url = <URL> await datex `
				#remote.timeout = 120_000;
				@example::#default.generateImage(${this.options.description})
			`
			console.log("url: ", url.toString(), this);

			const content = document.createElement("img")
			content.src = url.toString();
			content.style.width = "100%"
			this.formatContent(content)
			this.innerHTML = "";
			this.append(content)
		}

		private formatContent(content:HTMLElement){

			content.style.maxWidth = "100%";

			if (this.options.animate) content.classList.add("hover-float");
			if (this.options.glow) content!.style.boxShadow = "rgb(232 255 251 / 10%) 0px 0px 42px 13px";

			if (this.options.width) content!.style.width = this.options.width + "px";
			if (this.options.height) content!.style.height = this.options.height + "px";
			if (this.options.aspect) content!.style.aspectRatio = this.options.aspect.toString();

			content!.style.borderRadius = "10px"
		}
	}


	export namespace Document {
		export interface Options extends Base.Options {
			src? : string
		}
	}

	@Element
	export class Document extends Base<Document.Options> {
		constructor(options?: Image.Options) {
			super(options);
			if (this.wasLoadedStatic) return;
			this.loadPDF();
		}

		static pdfjsLoaded = false

		async loadPDF(){

			if (!Document.pdfjsLoaded) {
				const script = document.createElement("script");
				script.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@2.6.347/build/pdf.min.js";
				document.head.appendChild(script);
				Document.pdfjsLoaded = true;
				await new Promise(resolve=>setTimeout(()=>resolve, 2000))
			}
			
			const pdfjsLib = window['pdfjs-dist/build/pdf'];

			if (!pdfjsLib) {
				logger.error("could not load pdfjs lib");
				return;
			}

			pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdn.jsdelivr.net/npm/pdfjs-dist@2.6.347/build/pdf.worker.js';

			const pdf = await pdfjsLib.getDocument(this.options.src).promise;

			console.log('PDF loaded');
  
			// Fetch the first page
			const page = await pdf.getPage(1);
			console.log('Page loaded');
			
			const scale = 1;
			const viewport = page.getViewport({scale: scale});

			// Prepare canvas using PDF page dimensions
			const canvas = document.createElement('canvas');
			canvas.style.borderRadius = "10px"

			const context = canvas.getContext('2d');
			canvas.height = viewport.height;
			canvas.width = viewport.width;

			canvas.style.maxHeight = "100%"
			canvas.style.maxWidth = "100%"

			// Render PDF page into canvas context
			await page.render({
				canvasContext: context,
				viewport: viewport
			}).promise;

			this.append(canvas)
		}
		
	}

	export namespace Header {
		export interface ElementData {
			text?:Datex.CompatValue<string>,
			element?:HTMLElement,
			align?:'start'|'end',
			show_expanded?:boolean, // show element in expanded header, default true
			show_collapsed?:boolean, // show element in collapsed header, default true
		}

		export interface Options extends Elements.Base.Options {
			seperator?: boolean, // draw seperator line
			margin_bottom?: boolean, // margin bottom
			gaps?: number
		}
	}


	/**
	 * simple header element with arbitrary sub elements, supports windowControlsOverlay
	 */
	@Element
	export class Header extends Base<Header.Options> {
    
		protected container: HTMLElement
		protected elements: HTMLElement[] = []
		protected element_data: Header.ElementData[]

		protected drag_el: HTMLElement

		constructor(element_data:Header.ElementData[] = [], options?: Header.Options) {
			super(options)
			if (this.wasLoadedStatic) return;

			this.element_data = element_data;
	
			this.container = HTMLUtils.createHTMLElement("<div style='display:flex;align-items:center;width:100%'></div>");
	
			let end_elements:HTMLElement[] = [];

			for (let data of element_data) {
				if (data.align == 'end') end_elements.push(this.initElement(data)); // add to DOM container at end
				else this.container.appendChild(this.initElement(data)); // add to DOM container immediately
			}
			
			// to drag window with menu bar
			this.drag_el = HTMLUtils.createHTMLElement(`<div style="app-region:drag;flex:1;height:100%;"></div>`);
			this.container.append(this.drag_el);

			for (let data of end_elements) {
				this.container.appendChild(data); // add at start
			}
	
			this.append(this.container)
	
			this.style.paddingTop = 'env(safe-area-inset-top, 0px)'
			this.style.width = "100%";
			this.style.display = "block";
			this.container.style.whiteSpace = "nowrap";

			this.style.setProperty("--hsize", '1.2em');

			if (this.options.seperator) {
				this.style.paddingBottom = "10px";
				this.style.borderBottom = "2px solid #dddddd08";
			}
			if (this.options.margin_bottom) {
				this.style.marginBottom = "10px";
			}
			if (this.options.gaps) {
				this.container.style.gap = this.options.gaps + "px";
			}

			// @ts-ignore
			if (navigator.windowControlsOverlay) {
				this.update();
				// @ts-ignore
				navigator.windowControlsOverlay.addEventListener("geometrychange", ()=>this.update());
			}
			else this.handleWindowControlsOverlay(false);
	
			//this.html_element.css({"border-bottom": "2px solid var(--border_color)"})
		}

		private initElement(data:Header.ElementData) {

			let element:HTMLElement;

			if (data.element) {
				element = data.element;
			}
			else if (data.text) {
				element = document.createElement("h3");
				element.style.whiteSpace = "nowrap";
				element.style.margin = "0";
				element.style.paddingRight = "5px";
				element.style.fontSize = "var(--hsize)";
				HTMLUtils.setElementText(element, data.text);
			}

			this.elements.push(element!);
			return element!;
		}
	
		private handleWindowControlsOverlay(overlay:boolean) {
	
			// hide title
			if (overlay) {
				for (let i=0; i<this.elements.length; i++) { 
					if (this.element_data[i].show_collapsed===true || this.element_data[i].show_collapsed===undefined) this.elements[i].style.display = "initial";
					else this.elements[i].style.display = "none";
				}
			}
			else {
				for (let i=0; i<this.elements.length; i++) { 
					if (this.element_data[i].show_expanded===true || this.element_data[i].show_expanded===undefined) this.elements[i].style.display = "initial";
					else this.elements[i].style.display = "none";
				}
			}
	
		}

		public update() {
			// @ts-ignore
			if (!navigator.windowControlsOverlay) return;
			
			// only handle overlay if nearly at the top of the page
			// @ts-ignore
			let overlay = navigator.windowControlsOverlay.visible && (this.parentElement?.hasAttribute("root"))

			if (overlay) {
				// @ts-ignore
				const rect = navigator.windowControlsOverlay.getTitlebarAreaRect();
				const marginRight = document.body.clientWidth-(rect.x+rect.width) - this.getBoundingClientRect().x
				const marginLeft = rect.x - this.getBoundingClientRect().x
				
				this.container.style.marginLeft = marginLeft + "px";
				this.container.style.marginRight = marginRight + "px";
				this.container.style.width = `calc(100% - ${marginLeft+marginRight}px)`;
				this.container.style.height = rect.height + "px";

				// smaller header
				this.style.setProperty("--hsize", '1em');
				this.style.paddingBottom = "0";
				// shift - top margin of parent
				if (this.parentElement) this.style.marginTop = '-' + this.parentElement.style.paddingTop;
				
				this.handleWindowControlsOverlay(true);
			}
			else {
				this.container.style.width = `100%`;
				this.container.style.height = `auto`;
				this.container.style.marginLeft = "0";
				this.container.style.marginRight = "0";

				// default header
				this.style.setProperty("--hsize", '1.2em');
				if (this.options.seperator) this.style.paddingBottom = "10px";
				this.style.marginTop = 'initial';

				this.handleWindowControlsOverlay(false);
			}
		   
		}
	
	}


	// base class for elements displaying a single value
	export abstract class Value<T, O extends Elements.Base.Options = Elements.Base.Options> extends Base<O> {

		#value?:Datex.CompatValue<T>

		get datex_value():Datex.CompatValue<T>{
			return this.#value
		}

		get value():T{
			return this.#value instanceof Datex.Value ? this.#value.val : this.#value;
		}

		set value(value: Datex.CompatValue<T>){

			// get pointer if available
			value = Datex.Pointer.pointerifyValue(value);
			
			// set new DatexValue
			if (value instanceof Datex.Value) {
				value.observe((v, k, t)=>{
					// if (v !== undefined) this.setAttribute("value",v!==Datex.VOID?Datex.Runtime.valueToDatexString(v, false, true):"");
					this.onValueChanged(v, k, t)
				});
				this.#value = value;
				// if (value !== undefined) this.setAttribute("value",value!==Datex.VOID?Datex.Runtime.valueToDatexString(value, false, true):"");
				this.onValueChanged(value.val, undefined, Datex.Value.UPDATE_TYPE.INIT)
			}
			// update value of existing DatexValue
			else if (this.#value instanceof Datex.Value) {
				this.#value.val = value;
			}
			else {
				this.#value = value;
				// if (value !== undefined) this.setAttribute("value",value!==Datex.VOID?Datex.Runtime.valueToDatexString(value, false, true):"");
				this.onValueChanged(value, undefined, Datex.Value.UPDATE_TYPE.INIT)
			} 
		}

		// static get observedAttributes() { return ['value']; }

		// attributeChangedCallback(name:string, _:string, value:string) {
		//     console.log('chagned',name,value);
		// }

		// @implement
		protected abstract onValueChanged(value: any, key?: any, type?:Datex.Value.UPDATE_TYPE):void

		constructor(value?:Datex.CompatValue<T>, options?:O){
			super(options);
			if (this.wasLoadedStatic) return;
			if (value !== undefined) this.value = value;

			this.style.width = "fit-content";
			this.style.display = "inline-block"
			this.style.maxWidth = "-webkit-fill-available";
		}
	}

	export namespace Button {
		export interface Options extends Elements.Base.Options {
			onClick?:()=>any|Promise<any>
			pressed?:Datex.CompatValue<boolean>
			disabled?:Datex.CompatValue<boolean>
			text?:Datex.CompatValue<string>
			content?:Datex.CompatValue<string|HTMLElement>
			icon?:Datex.CompatValue<string|HTMLElement>
			color?:Datex.CompatValue<string>
			text_color?:Datex.CompatValue<string>
			glow?: Datex.CompatValue<boolean>
		}
	}

	// simple button
	// uses css uix-button for style
	@Element
	export class Button<O extends Elements.Button.Options = Elements.Button.Options> extends Value<boolean, O> {

		constructor(options?:O) {
			super(undefined, options);
			if (this.wasLoadedStatic) return;

			if (this.options.color) this.css('--bg-color', this.options.color);

			if (this.options.text_color) this.css('color', this.options.text_color);
			else this.css('color', Theme.getColorReference('text_highlight'));

			// deno-lint-ignore no-this-alias
			let content:HTMLElement = this;

			if (this.options.icon) {
				const icon = document.createElement("span");
				icon.style.marginRight = "5px";
				if (typeof this.options.icon == "string") HTMLUtils.setElementText(icon, this.options.icon);
				else HTMLUtils.setElementHTML(icon, this.options.icon);

				content = document.createElement("span");
				this.append(icon);
				this.append(content);
			}

			if (this.options.text) HTMLUtils.setElementText(content, this.options.text);
			if (this.options.content) HTMLUtils.setElementHTML(content, this.options.content);
			
			// handle disabled state
			if (this.options.disabled) {
				Datex.Value.observeAndInit(this.options.disabled, (disabled)=>{
					if (disabled) {
						this.disableShadow();
						this.setAttribute("disabled", "");
						this.removeAttribute("tabindex");
					}
					else {
						this.enableShadow()
						this.removeAttribute("disabled");
						this.setAttribute("tabindex", "0");
					}
				})
			}
			else this.setAttribute("tabindex", "0");
	
			if (this.options.pressed) this.value = this.options.pressed;

			this.setAttribute("role", "button");
			
			this.addEventListener("mousedown", event=>this.onButtonDown(event))
			this.addEventListener("mouseup", event=>this.onButtonUp(event))
			this.addEventListener("click", event=>this.onClick(event))
			this.addEventListener("keypress", event=>{
				if (event.key === "Enter") this.onClick(event)
			});
		}

		protected enableShadow(){
			// TODO use css 5 color() to add dynamic alpha to --bg-color 
			if (this.options.glow) this.css('--bg-color-shadow', Utils.addAlphaToColor(<`#${string}`>HTMLUtils.getCSSProperty(this.options.color, false), 20));
		}
		protected disableShadow(){
			this.css('--bg-color-shadow', 'transparent');
		}

		protected onValueChanged(value: boolean): void {
			if (value) this.onButtonDown();
			else this.onButtonUp()
		}
		
		protected onButtonDown(event?:MouseEvent){}
		protected onButtonUp(event?:MouseEvent){}

		protected onClick(event:MouseEvent|KeyboardEvent){
			event.stopPropagation();
			event.stopImmediatePropagation();
			event.preventDefault();
			if ('disabled' in this.options && Datex.Value.collapseValue(this.options.disabled, true, true)) return; // ignore
			this.options.onClick?.call(this)
		}
	}

	export namespace ToggleButton {
		export interface Options extends Elements.Button.Options {
			onChange?:(checked:boolean)=>any|Promise<any>
			checked?:Datex.CompatValue<boolean>
			checked_color?:Datex.CompatValue<string>,
		}
	}

	// toggle button
	@Element
	export class ToggleButton extends Button<Elements.ToggleButton.Options> {
	
		constructor(options:Elements.ToggleButton.Options) {
			super(options);
			if (this.wasLoadedStatic) return;
			this.value = this.options.checked;
		}

		// toggle active state
		protected override onClick() {
			this.value = !this.value
		}

		protected override onValueChanged(): void {
			/* TODO use instead of try catch:  if (#onChange in this) */
			try {
				this.options.onChange?.call(this, this.value);
			} catch {}

			if (this.value) this.css('color', this.options.checked_color??'');
			else this.css('color', this.options.text_color??'');
		}
	}

	export namespace Checkbox {
		export interface Options extends Elements.Button.Options {
			onChange?:(checked:boolean)=>any|Promise<any>
			checked?:Datex.CompatValue<boolean>
			checked_color?:Datex.CompatValue<string>
			label?:Datex.CompatValue<string|Datex.Markdown>,
			markdown?: boolean
		}
	}

	@Element
	export class Checkbox extends Value<boolean, Elements.Checkbox.Options>  {

		#input:HTMLInputElement
		#internal_update = false

		constructor(options?:Elements.Checkbox.Options) {
			super(undefined, options);
			if (this.wasLoadedStatic) return;

			const input_id = Utils.getUniqueElementId();

			const group = document.createElement("div");
			group.classList.add("checkbox-group");

			this.#input = document.createElement("input");
			this.#input.setAttribute("type", "checkbox");
			this.#input.setAttribute("id", input_id)
			this.#input.setAttribute("tabindex", "-1")
			this.setAttribute("tabindex", "0");

			const label = document.createElement("label");
			label.setAttribute("for", input_id)

			if (this.options.label){
				HTMLUtils.setElementText(label, this.options.label, this.options.markdown);
				group.classList.add("withlabel")
			}
			HTMLUtils.setCSSProperty(label, "--checked-color", this.options.checked_color ?? Theme.getColorReference('accent'))

			this.#input.addEventListener("click", ()=>{
				this.#internal_update = false;
				this.value = this.#input.checked;
			})

			this.addEventListener("keydown", (e)=>{
				if (e.code == "Enter" || e.code == "Space") {
					this.#internal_update = false;
					this.#input.checked = !this.#input.checked;
					this.value = this.#input.checked;
				}
			})

			group.append(this.#input);
			group.append(label);
			this.append(group);

			this.value = this.options.checked;
		}

		protected override onValueChanged(): void {
			/* TODO use instead of try catch:  if (#onChange in this) */
			try {
				this.options.onChange?.call(this, this.value);
			} catch {}

			// prevent recursive updates
			if (this.#internal_update) {
				this.#internal_update = false;
				return;
			}

			this.#input.checked = this.value;
		}
	}

	@Element
	export class ToggleSwitch extends Value<boolean, Elements.Checkbox.Options>  {

		#input:HTMLInputElement
		#internal_update = false

		constructor(options?:Elements.Checkbox.Options) {
			super(undefined, options);
			if (this.wasLoadedStatic) return;

			let input_id = Utils.getUniqueElementId();

			const group = document.createElement("div");
			group.style.display = "flex"
			group.style.alignItems = "baseline"

			this.#input = document.createElement("input");
			this.#input.setAttribute("type", "checkbox");
			this.#input.setAttribute("id", input_id)
			this.#input.classList.add("switch");

			const outer = document.createElement("label");
			outer.classList.add("switch");
			outer.setAttribute("for", input_id)

			const label = document.createElement("label");
			label.style.marginLeft = "5px";
			label.setAttribute("for", input_id)

			if (this.options.label) HTMLUtils.setElementText(label, this.options.label);
			HTMLUtils.setCSSProperty(outer, "--checked-color", this.options.checked_color ?? Theme.getColorReference('accent'))

			this.#input.addEventListener("click", ()=>{
				this.#internal_update = false;
				this.value = this.#input.checked;
			})

			group.append(this.#input);
			group.append(outer);
			group.append(label);
			this.append(group)

			this.value = this.options.checked;
		}

		protected override onValueChanged(): void {
			/* TODO use instead of try catch:  if (#onChange in this) */
			try {
				this.options.onChange?.call(this, this.value);
			} catch {}

			// prevent recursive updates
			if (this.#internal_update) {
				this.#internal_update = false;
				return;
			}

			this.#input.checked = this.value;
		}
	}


	export namespace ValueDisplay {
		export interface Options extends Elements.Base.Options {
			selectable?: Datex.CompatValue<boolean>,
			text_size?: Datex.CompatValue<string>,
			text_color?: Datex.CompatValue<string>,
			text_color_highlight?: Datex.CompatValue<string>,
			text_color_light?: Datex.CompatValue<string>,
			editable?: Datex.CompatValue<boolean>,
			edit_bg_color?: Datex.CompatValue<string>,
			select_on_focus?: Datex.CompatValue<boolean>,
			spellcheck?: Datex.CompatValue<boolean>,
			new_lines?: Datex.CompatValue<boolean>,
			markdown?: boolean
		}
	}

	// simple <span> like element displaying a value
	@Element
	export class ValueDisplay<T, O extends Elements.ValueDisplay.Options = Elements.ValueDisplay.Options> extends Value<T, O> {
	
		#internal_update = false;

		constructor(value:Datex.CompatValue<T>, options?:O) {
			super(undefined, options);
			if (this.wasLoadedStatic) return;
			this.value = value;

			this.style.cursor = "default";

			if (this.options.selectable) {
				this.css('user-select', transform([this.options.selectable], (s)=>s?'text':'none'));
				this.css('cursor', transform([this.options.selectable], (s)=>s?'text':'default'));
			}
			if (this.options.text_size) this.css('font-size', this.options.text_size);
			if (this.options.text_color) {
				this.css('color', this.options.text_color);
				this.css('--current_text_color', this.options.text_color)
			}
			if (this.options.text_color_highlight) {
				this.css('--current_text_color_highlight', this.options.text_color_highlight)
			}
			if (this.options.text_color_light) {
				this.css('--current_text_color_light', this.options.text_color_light)
			}
			if (this.options.editable != undefined) {
				this.style.outline = "0px solid transparent"; // override focus outline

				HTMLUtils.setCSSProperty(this, "cursor", transform([this.options.editable], v=>v?'text':'default'));
				const plaintext_only = PLEEASE_FIREFOX ? 'true' : 'plaintext-only';
				HTMLUtils.setElementAttribute(this, "contenteditable", transform([this.options.editable], v=>v?plaintext_only:'false'));
				this.addEventListener("input", async e => {
					//if (Datex.Value.collapseValue(this.options.new_lines) && e.keyCode == "Enter") 
					this.#internal_update = true;
					this.value = await this.convertFromDisplayText(this.textContent);
				});

				this.addEventListener('keydown', e => {
					e.stopPropagation();
					if (!Datex.Value.collapseValue(this.options.new_lines) && e.key === "Enter") e.preventDefault(); // don't allow Enter
				});
				this.addEventListener('paste', e => {
					if (!Datex.Value.collapseValue(this.options.new_lines)) {
						e.preventDefault();
						// @ts-ignore
						let paste = (e.clipboardData || window.clipboardData).getData('text');
						// @ts-ignore
						e.target.value = paste.replace(/\n/g, '')
					}
				});

				if (this.options.edit_bg_color) {
					this.addEventListener("focus", ()=>{
						HTMLUtils.setCSSProperty(this, 'background-color', this.options.edit_bg_color)
					})
					this.addEventListener("blur", ()=>{
						HTMLUtils.setCSSProperty(this, 'background-color', '')
					})
				}

				if (this.options.select_on_focus) {
					let range, selection;
					this.addEventListener("focus", ()=>{
						if (Datex.Value.collapseValue(this.options.select_on_focus, true, true) === true) {
							if (window.getSelection) {
								selection = window.getSelection();
								range = document.createRange();
								range.selectNodeContents(this);
								selection.removeAllRanges();
								selection.addRange(range);
							}
						}
					});
				}

				this.addEventListener("blur", ()=>{
					if (window.getSelection) {
						if (window.getSelection().empty) {  // Chrome
							window.getSelection().empty();
						} else if (window.getSelection().removeAllRanges) {  // Firefox
							window.getSelection().removeAllRanges();
						}
					}
				})
			}
			if (this.options.spellcheck != undefined) {
				HTMLUtils.setElementAttribute(this, "spellcheck", this.options.spellcheck);
			}
		}

		protected onValueChanged(value: T) {
			// prevent recursive updates
			if (this.#internal_update) {
				this.#internal_update = false;
				return;
			}
			this.innerText = value;
		}

		override set innerText(value:Datex.CompatValue<T>|string){
			Datex.Value.observeAndInit(value, (val)=>{
				const content = this.#getTextOrHTML(val);
				if (content instanceof HTMLElement) {super.innerHTML = content.innerHTML}
				else super.innerText = content;
			})
			// if (value instanceof Datex.Value) {
			// 	const content = this.#getTextOrHTML(value.val);
			// 	if (content instanceof HTMLElement) super.innerText = this.#getTextOrHTML(value.val)
			// 	else
			// 	value.observe(()=>{
			// 		super.innerText = this.#getTextOrHTML(value.val)
			// 	});
			// }
			// else if (value !== undefined) super.innerText = this.#getTextOrHTML(value);
		}

		override get innerText():string{return super.innerText}

		#getTextOrHTML(value:T|string):string|HTMLElement{
			if (typeof value == "string" && this.options.markdown) return new Datex.Markdown(value).getHTML();
			else if (typeof value == "string") return value;
			else return this.convertToDisplayTextOrHTML(value)
		}

		// override for custom value -> display text conversion
		protected convertToDisplayTextOrHTML(value:T):string|HTMLElement{
			return Datex.Runtime.valueToDatexString(value)
		}

		protected convertFromDisplayText(value:string):T|Promise<T> {
			return <T><unknown>value;
		}
	}

	
	// simple text
	@Element
	export class Text extends ValueDisplay<string|Datex.Markdown> {
		// override for custom value -> display text conversion
		protected convertToDisplayTextOrHTML(value:string|Datex.Markdown):string{
			if (typeof value == "string") return value;
			else if (value instanceof Datex.Markdown) return value.getHTML();
		}
	} 


	export namespace Number {
		export interface Options extends Elements.ValueDisplay.Options {
			unit?:string, 
			factor?:number, 
			fixed_decimal_places?:number, 
			min?:number, 
			max?:number
		}
	}

	// formatted value as text
	@Element
	export class Number extends ValueDisplay<number|bigint, Number.Options> {

		constructor(value:Datex.CompatValue<number|bigint>, options?:Number.Options) {
			super(undefined, options);
			if (this.wasLoadedStatic) return;

			this.value = value;
		}

		protected override convertFromDisplayText(value: string): number | bigint {
			if (typeof this.value == "bigint") return BigInt(value);
			else return globalThis.Number(value);
		}

		override convertToDisplayTextOrHTML(value:number|bigint) {
			// bigint * factor
			if (typeof value == "bigint" && this.options.factor!=undefined)  {
				if (Math.abs(this.options.factor)>=1) value = value*(BigInt(Math.round(this.options.factor))); // multiply
				else value = globalThis.Number(value) * this.options.factor // divide
			}
			// number * factor
			else if (typeof value == "number" && this.options.factor!=undefined) value = value*this.options.factor;

			// clamp max,min
			const clamped_value = Math.max(this.options.min??-Infinity, Math.min(this.options.max??Infinity, globalThis.Number(value)));
			
			// integer places
			let string:string;
			if (this.options.fixed_decimal_places != undefined) {
				if (typeof value == "number") string = clamped_value.toFixed(this.options.fixed_decimal_places)
				else if (typeof value == "bigint") string = BigInt(Math.round(clamped_value)).toString() + (this.options.fixed_decimal_places ?  "." + "0".repeat(this.options.fixed_decimal_places) : "");
			}
			// no fixed integer places
			else string = clamped_value.toString()

			return string + (this.options.unit??"")
		}
	}


	export namespace ValueInput {
		export interface Options extends Elements.Base.Options {
			placeholder?:Datex.CompatValue<string>,
			input_css?: {property: string, value: string}[],
			valid?:Datex.CompatValue<boolean>
		}
	}

	// simple <input> element
	export abstract class ValueInput<T, O extends ValueInput.Options = ValueInput.Options> extends Value<T,O> {
	
		#input = document.createElement("input");
		#internal_update = false;
		#invalid = false;

		// override get style() {
		//     return this.#input.style
		// }

		// override get classList() {
		//     return this.#input.classList
		// }

		set invalid(invalid:boolean){
			this.#invalid = invalid;
			if (invalid) this.#input.classList.add("invalid")
			else this.#input.classList.remove("invalid")
		}

		get invalid(){
			return this.#invalid;
		}

		public getInputType(): string | null {
			return this.#input.getAttribute("type");
		}

		public setInputType(type: "password" | "text" | "email" = "text"): this {
			return this.#input.setAttribute("type", type), this;
		}


		constructor(value?:Datex.CompatValue<T>, type = "text", options?:O) {
			super(undefined, options);
			if (this.wasLoadedStatic) return;

			this.#input.setAttribute("type", type);
			this.#input.classList.add("input");
			this.#input.style.width = "100%"; // TODO: move to css?
			if (this.#input.type == "date") this.#input.style.padding = "2px";

			if (this.options.input_css) {
				for (const prop of this.options.input_css)
					this.#input.style.setProperty(prop.property,prop.value)
			}
			this.append(this.#input);

			this.value = value;

			if (this.options.placeholder) HTMLUtils.setElementAttribute(this.#input, "placeholder", this.options.placeholder);

			if ('valid' in this.options) {
				Datex.Value.observeAndInit(this.options.valid, (valid:boolean)=> {
					if (valid) this.#input.classList.remove("invalid")
					else this.#input.classList.add("invalid")
				})
			}
			
			this.#input.addEventListener("input", async ()=>{
				this.#internal_update = true;
				this.value = await this.convertFromInputValue(this.#input.value);
			})

			this.#input.addEventListener("keydown", (e)=>{
				if (e.key == "Enter") this.#input.blur();
				e.stopPropagation();
			})

			this.#input.addEventListener("dblclick", (e)=>{
				e.stopPropagation();
			})
		}

		protected convertFromInputValue(input_value:string):T|Promise<T>{
			return <T><unknown>input_value;
		}

		protected setInputValue(input: HTMLInputElement, value:T) {
			input.value = value.toString();
		}

		protected onValueChanged(value: T): void {
			// prevent recursive updates
			if (this.#internal_update) {
				this.#internal_update = false;
				return;
			}
			if (value!=undefined) this.setInputValue(this.#input, value);
		}
	}

	@Element
	export class TextInput extends ValueInput<string> {
		constructor(value?:Datex.CompatValue<string>, options?:ValueInput.Options) {
			super(value, "text", options);
		}
	}
	
	@Element
	export class EMailInput extends ValueInput<string> {
		constructor(value?:Datex.CompatValue<string>, options?:ValueInput.Options) {
			super(value, "email", options);
		}
	}

	@Element
	export class PasswordInput extends ValueInput<string> {
		constructor(value?:Datex.CompatValue<string>, options?:ValueInput.Options) {
			super(value, "password", options);
		}
	}

	export namespace ContainerValueInput {
		export interface Options extends ValueInput.Options {
			type?: "password" | "text" | "email"
		}
	}

	@Element
	export class ContainerValueInput<T, O extends ContainerValueInput.Options = ContainerValueInput.Options> extends Value<T,O> {
		private input: TextInput;
		private toggleVisibilityButton: HTMLElement;

		set invalid(invalid:boolean){
			this.input.invalid = invalid;
		}

		get invalid(){
			return this.input.invalid;
		}


		constructor(value?:Datex.CompatValue<string>, options?:ContainerValueInput.Options) {
			super(undefined, <O>{});
			if (this.wasLoadedStatic) return;
			
			this.input = new TextInput(value, options);

			this.input.style.width = '-webkit-fill-available'
			
			this.input.setInputType(options?.type);
			const container = HTMLUtils.setCSS(HTMLUtils.createHTMLElement("<div></div>"), {
				display: "flex",
				position: "relative"
			});
			this.toggleVisibilityButton =  HTMLUtils.setCSS(HTMLUtils.createHTMLElement(I`fa-eye-slash`), {
				position: "absolute",
				display: "flex",
				"align-items": "center",
				height: "100%",
				right: "5px"
			});
			this.toggleVisibilityButton.onclick = () => this.toggleVisiblity();

			container.append(this.input);
			container.append(this.toggleVisibilityButton);
			this.append(container);
		}

		protected toggleVisiblity() {
			this.toggleVisibilityButton.classList.toggle("fa-eye")
			this.toggleVisibilityButton.classList.toggle("fa-eye-slash")
			if (this.input.getInputType() === "password")
				this.input.setInputType("text");
			else this.input.setInputType("password");
		}

		protected onValueChanged(value: any,key?: any,type?: any): void {
			
		}
	}

	export namespace NumberInput {
		export interface Options extends Elements.Base.Options {
			min?:number,  // default -infinity
			max?:number,  // default infinity
			fixed_boundaries?:boolean, // default true
			show_slider?:boolean,
			show_carets?:boolean,
			show_number?:boolean, // default true
			center_number?:boolean,
			unit?:string,
			label?:Datex.CompatValue<string>,
			number_color?:Datex.CompatValue<string>,
			slider_color?:Datex.CompatValue<string>,
			label_color?:Datex.CompatValue<string>,
			decimals?:number, // default 3
			update_on_blur?:boolean // update value only when input field blurred (or enter pressed)
		}
	}

	@Element
	export abstract class NumberInput<T extends number|bigint|Quantity, O extends NumberInput.Options = NumberInput.Options> extends Value<T, O> {

		#container = document.createElement("div");
		#input = document.createElement("input");
		#slider_container = document.createElement("div");
		#slider_text = document.createElement("div");
		#slider_number = document.createElement("div");
		#slider_label = document.createElement("div");

		#slider:HTMLDivElement
		#caret_left:HTMLDivElement
		#caret_right:HTMLDivElement

		#min:number
		#max:number

		#default_min:number
		#default_max:number

		#internal_update = false;


		protected input_validation_regex:RegExp
		protected input_validation_regex_complete:RegExp

		// override get style() {
		//     return this.#container.style
		// }

		// override get classList() {
		//     return this.#container.classList
		// }

		#invalid = false;
		set invalid(invalid:boolean){
			this.#invalid = invalid;
			if (invalid) this.#input.classList.add("invalid")
			else this.#input.classList.remove("invalid")
		}

		get invalid(){
			return this.#invalid;
		}

		constructor(value:Datex.CompatValue<T>, options?:O) {
			super(undefined, options);
			if (this.wasLoadedStatic) return;

			this.options.show_number = this.options.show_number ?? true;
			this.options.fixed_boundaries = this.options.fixed_boundaries ?? true;
			
			this.#default_min = this.#min = this.options.min ?? (this.options.show_slider ? 0 : -Infinity);
			this.#default_max = this.#max = this.options.max ?? (this.options.show_slider ? 100 : Infinity)

			this.style.width = "fit-content";

			this.setAttribute("tabindex", "0"); // allow focus even if actual input element is hidden
			this.classList.add("no-focus-outline");

			this.#container.style.position = "relative";
			this.#container.style.borderRadius = "5px";
			this.#container.style.overflow = "hidden";
			this.#container.style.zIndex = "1";
			this.#container.style.cursor = "default";
			this.#container.style.backgroundColor = "var(--bg_content_dark)";

			this.#slider_container.style.display = "flex";
			this.#slider_container.style.position = "relative";
			this.#slider_container.style.cursor = "col-resize"
			this.#slider_container.style.borderRadius = "5px"

			if (this.options.show_slider) {
				this.#slider = document.createElement("div");
				this.#slider.style.position = "absolute";
				this.#slider.style.left = "0";
				this.#slider.style.top = "0";
				this.#slider.style.backgroundColor = "var(--bg_input)";
				this.#slider.style.height = "100%";
				//this.#slider.style.width = "50%";
				this.#slider.style.zIndex = "-1";
				if (this.options.slider_color) HTMLUtils.setCSSProperty(this.#slider, 'background-color', this.options.slider_color);
			}

			let careting = false;
			
			if (this.options.show_carets) {
				this.#caret_left = document.createElement("div");
				this.#caret_left.style.padding = "0px 5px"
				this.#caret_left.style.display = "flex"
				this.#caret_left.style.alignItems = "center"
				this.#caret_left.style.cursor = "default"
				if (this.options.slider_color) this.#caret_left.style.mixBlendMode = "difference"
				if (this.options.label_color) HTMLUtils.setCSSProperty(this.#caret_left, 'color', this.options.label_color);
				this.#caret_left.innerHTML = I('fas-caret-left')
				
				let left_interval:number;
				this.#caret_left.addEventListener("mousedown", e=>{
					careting = true;
					e.stopPropagation();
					this.decrementValue();
					setTimeout(()=>{
						if (careting == false) return;
						clearInterval(left_interval);
						left_interval = setInterval(()=>this.decrementValue(), 50);
					},600)
				})


				this.#caret_right = document.createElement("div");
				this.#caret_right.style.padding = "0px 5px"
				this.#caret_right.style.display = "flex"
				this.#caret_right.style.alignItems = "center"
				this.#caret_right.style.cursor = "default"
				if (this.options.slider_color) this.#caret_right.style.mixBlendMode = "difference"
				if (this.options.label_color) HTMLUtils.setCSSProperty(this.#caret_right, 'color', this.options.label_color);
				this.#caret_right.innerHTML = I('fas-caret-right')
				
				let right_interval:number;
				this.#caret_right.addEventListener("mousedown", e=>{
					careting = true;
					e.stopPropagation();
					this.incrementValue();
					setTimeout(()=>{
						if (careting == false) return;
						clearInterval(right_interval);
						right_interval = setInterval(()=>this.incrementValue(), 50);
					},600)
				})

				this.#slider_container.append(this.#caret_left)

				window.addEventListener("mouseup", e=>{
					e.stopPropagation();
					clearInterval(left_interval);
					clearInterval(right_interval);
					setTimeout(()=>careting = false, 0)
				})
			}

			this.#slider_text.style.display = "flex";
			this.#slider_text.style.justifyContent = this.options.center_number ? "center" : "space-between";
			this.#slider_text.style.width = "100%";

			this.#slider_label.style.marginLeft = "5px";
			if (this.options.slider_color) this.#slider_label.style.mixBlendMode = "difference" //this.options.slider_color == this.options.label_color ? "difference" : "plus-lighter";
			HTMLUtils.setElementText(this.#slider_label, this.options.label ?? "?");
			if (this.options.label_color) HTMLUtils.setCSSProperty(this.#slider_label, 'color', this.options.label_color);
			if (!this.options.label) this.#slider_label.style.visibility = "hidden";
			this.#slider_text.append(this.#slider_label);

			if (this.options.show_number) {
				this.#slider_number.style.height = "100%";
				this.#slider_number.style.display = "flex";
				this.#slider_number.style.alignItems = "center";
				this.#slider_number.style.marginRight = "5px";
				this.#slider_number.style.marginLeft = "5px";
				this.#slider_number.style.whiteSpace = "nowrap";
				this.#slider_number.style.overflow = "hidden";
				this.#slider_number.style.textOverflow = "ellipsis";
				this.#slider_number.style.justifyContent = "flex-end";

				this.#slider_number.style.fontFamily = 'Menlo, Monaco, "Courier New", monospace';
				if (this.options.slider_color) this.#slider_number.style.mixBlendMode = "difference";
				if (this.options.number_color) HTMLUtils.setCSSProperty(this.#slider_number, 'color', this.options.number_color);

	
				this.#input.style.position = "absolute";
				this.#input.style.width = "100%";
				this.#input.style.height = "100%";
				this.#input.style.top = "0";
				this.#input.style.left = "0";
				this.#input.style.zIndex = "-2";
				this.#input.style.visibility = "hidden"
				this.#input.style.fontFamily = 'Menlo, Monaco, "Courier New", monospace';
				this.#input.style.textAlign = "right";
				if (this.options.number_color) HTMLUtils.setCSSProperty(this.#input, 'color', this.options.number_color);

				if (this.options.decimals == 0) this.#input.setAttribute("inputmode", "numeric")
				else this.#input.setAttribute("inputmode", "decimal")

				this.#input.setAttribute("type", "text");
				this.#input.classList.add("input");

				this.#slider_text.append(this.#slider_number);
				this.#container.append(this.#input);
			}



			this.#slider_container.append(this.#slider_text);
			if (this.options.show_carets) this.#slider_container.append(this.#caret_right)

			if (this.options.show_slider) this.#slider_container.append(this.#slider);
			this.#container.append(this.#slider_container);
			this.append(this.#container);

			this.value = value;
			
			if (this.options.show_number) {

				let last_input_value:string;

				const showInput = () => {
					this.#slider_container.style.visibility = "hidden";
					this.#input.style.visibility = "visible"
					this.#input.focus()
					this.#input.select();
					last_input_value = this.#input.value;
				}


				this.#input.addEventListener("input", async (e)=>{
					// invalid input
					if (!this.validateInput(this.#input.value)) {
						this.#input.value = last_input_value; // reset input value change
					}
					// valid input and parseable to value
					else if (this.validateInputComplete(this.#input.value)) try {
						this.#internal_update = true;
						last_input_value = this.#input.value;
						if (!this.options.update_on_blur) this.value = this.clampMinMax(await this.convertFromInputValue(this.#input.value));
					} catch {} // ignore at this point, value is not changed
					// else just accept input until validateInputComplete
					else {
						last_input_value = this.#input.value;
					} 
				})

				this.#input.addEventListener("blur", async ()=>{
					this.#slider_container.style.visibility = "visible";
					this.#input.style.visibility = "hidden"
					this.onValueChanged(this.value); // force update

					// check if input conversion throws an error -> reset input to previous value
					try {
						this.value = this.clampMinMax(await this.convertFromInputValue(this.#input.value));
					}
					// invalid input
					catch {
						this.#internal_update = false;
						this.onValueChanged(this.value); // force update 
					} 
				})
				this.#input.addEventListener("keydown", (e)=>{
					if (e.key == "Enter") this.#input.blur();
					e.stopPropagation();
				})

				this.#input.addEventListener("dblclick", (e)=>{
					e.stopPropagation();
				})
			
				this.#slider_container.addEventListener("click", (e)=>{
					if (moving || careting) return;
					showInput();
				})

				this.addEventListener("keydown", (e)=>{
					if (e.key == "Tab" || e.key == "Shift" || e.key == "Control" || e.key == "Alt") return; // ignore
					else if (e.key == "ArrowLeft") this.decrementValue();
					else if (e.key == "ArrowRight") this.incrementValue();
					else showInput();
				})

				this.addEventListener("focus", ()=>{
					this.#slider_container.style.boxShadow = "var(--text_highlight) 0px 0px 0px 2px inset"
				})
				this.addEventListener("blur", ()=>{
					this.#slider_container.style.boxShadow = "none"
				})


			}

			let startX:number;
			let startValue:number;
			let moving = false;
			let is_touch = false;

			const moveHandler = (e:MouseEvent|TouchEvent)=>{
				moving = true;
				const deltaPix = Math.round((globalThis.TouchEvent && e instanceof TouchEvent) ? e.touches[0].clientX : (<MouseEvent>e).clientX) - startX;
				const deltaVal = this.options.show_slider ? (deltaPix/this.#slider_container.getBoundingClientRect().width) * (this.#max - this.#min) : deltaPix;
				const decimal_trunc_factor = 10 ** (this.options.decimals??3); // truncate deltaVal at 3.. decimals
				const newValue = Math.trunc((startValue+deltaVal) * decimal_trunc_factor) / decimal_trunc_factor; 

				// only set value if within bounds
				if (newValue<this.#min) this.value = this.convertNumberToValue(this.#min); 
				else if (newValue>this.#max) this.value = this.convertNumberToValue(this.#max);
				else this.value = this.convertNumberToValue(newValue); 
			}

			const mouseUpHandler = (e:MouseEvent|TouchEvent)=>{
				if (is_touch) {
					window.removeEventListener("touchmove", moveHandler)
					window.removeEventListener("touchend", mouseUpHandler)
				}
				else {
					window.removeEventListener("mousemove", moveHandler)
					window.removeEventListener("mouseup", moveHandler)
				}
				setTimeout(()=>moving = false,20);
			}

			this.#slider_container.addEventListener("mousedown", (e)=>{
				moving = false;
				is_touch = false;
				startX = Math.round(e.clientX);
				startValue = globalThis.Number(this.value);
				window.addEventListener("mousemove", moveHandler)
				window.addEventListener("mouseup", mouseUpHandler)
				e.stopPropagation();
			})
			this.#slider_container.addEventListener("touchstart", (e)=>{
				moving = false;
				is_touch = true;
				startX = Math.round(e.touches[0].clientX);
				startValue = globalThis.Number(this.value);
				window.addEventListener("touchmove", moveHandler)
				window.addEventListener("touchend", mouseUpHandler)
				e.stopPropagation();
			}, {passive:true})


			// regex
			this.input_validation_regex = new RegExp(`^ *(-|\\+)?((\\d*(\\.\\d${this.options.decimals?`{0,${this.options.decimals}}`:'*'})?)|(\\d+(\\.\\d${this.options.decimals?`{0,${this.options.decimals}}`:'*'})?|(\\.\\d${this.options.decimals?`{0,${this.options.decimals}}`:'*'}))((E|e)(-|\\+)?\\d*)?) *$`);
			this.input_validation_regex_complete = new RegExp(`^ *(-|\\+)?(\\d*\.)?\\d${this.options.decimals?`{1,${this.options.decimals}}`:'+'}((E|e)(-|\\+)?\\d+)? *$`);

		}

		protected incrementValue(){
			this.value=this.clampMinMax(this.convertNumberToValue(this.convertValueToNumber(this.value)+1))
		}
		protected decrementValue(){
			this.value=this.clampMinMax(this.convertNumberToValue(this.convertValueToNumber(this.value)-1))
		}

		protected abstract convertFromInputValue(input_value:string):T|Promise<T>
		protected abstract convertNumberToValue(value:number):T
		protected abstract convertValueToNumber(value:T):number
		protected abstract shortValue(value:T):string

		protected setInputValue(input: HTMLInputElement, value:T) {
			if (!isFinite(globalThis.Number(value))) input.value = Datex.Runtime.valueToDatexString(value);
			else input.value = value.toString();
		}

		// return true if the input is valid (but might not yet be complete to get parsed into a valid value)
		protected validateInput(input_value:string):boolean {
			return !!input_value.match(this.input_validation_regex);
		}

		// return true if the input is valid and can be parsed to a valid value
		protected validateInputComplete(input_value:string):boolean {
			return !!input_value.match(this.input_validation_regex_complete);
		}

		protected clampMinMax(value:T) {
			if (this.options.fixed_boundaries) {
				if (value > this.#max) return this.convertNumberToValue(this.#max);
				if (value < this.#min) return this.convertNumberToValue(this.#min);
			}
			return value;
		}

		// @implement
		protected onValueChanged(value: T): void {
			// update UI
			this.#slider_number.innerText = this.shortValue(value) + (this.options.unit ? this.options.unit : "");

			const valueNumber = this.convertValueToNumber(value);
			// adjust max/min if value exceeds boundaries
			if (!this.options.fixed_boundaries && isFinite(valueNumber)) {
				if (valueNumber > this.#max) {
					this.#max = valueNumber;
					this.#min = this.#default_min;
				}
				else if (valueNumber < this.#min) {
					this.#min = valueNumber;
					this.#max = this.#default_max;
				}
			}
			
			if (this.options.show_slider) {
				const percent = (valueNumber - this.#min) / (this.#max - this.#min) * 100 // 0 - 100
				this.#slider.style.width = percent + "%"
			}

			// prevent recursive updates
			if (this.#internal_update) {
				this.#internal_update = false;
				return;
			}
			if (value!=undefined) this.setInputValue(this.#input, value);
		}
	} 

	@Element
	export class IntegerInput extends NumberInput<bigint> {
		protected override convertFromInputValue(input_value:string):bigint|Promise<bigint>{
			return BigInt(Math.round(globalThis.Number(input_value)));
		}
		protected override convertNumberToValue(value:number){
			return BigInt(Math.round(value));
		}
		protected override convertValueToNumber(value:bigint):number{
			return globalThis.Number(value);
		}
		protected override shortValue(value:bigint):string{
			return value.toString();
		}
		protected override validateInput(input_value:string):boolean {
			return !!input_value.match(/^ *(-|\+)?\d* *$/);
		}
		protected override validateInputComplete(input_value:string):boolean {
			return !!input_value.match(/^ *(-|\+)?\d+ *$/);
		}
	} 

	@Element
	export class FloatInput extends NumberInput<number> {
		protected convertFromInputValue(input_value:string):number|Promise<number> {
			return <number><unknown>globalThis.Number(input_value);
		}
		protected convertNumberToValue(value:number):number{
			return <number><unknown>value;
		}
		protected convertValueToNumber(value:number):number{
			return globalThis.Number(value);
		}

		protected shortValue(value:number):string{
			if (!isFinite(globalThis.Number(value))) return Datex.Runtime.valueToDatexString(value);
			return globalThis.Number(value).toFixed(this.options.decimals ?? 3);
		}
	} 

	export namespace QuantityInput {
		export interface Options extends NumberInput.Options {
			short?:boolean,
			permittedUnits?:Quantity[] // TODO
		}
	}
	@Element
	export class QuantityInput<U extends Unit> extends NumberInput<Quantity<U>, QuantityInput.Options> {
		
		unit: unit;

		constructor(value:Datex.CompatValue<Quantity<U>>, options:QuantityInput.Options = {}) {
			const quantity = Datex.Value.collapseValue(value,true,true);
			options.unit = ' ' + quantity.unit_formatted_short;
			super(value, options);
			if (this.wasLoadedStatic) return;

			this.unit = quantity.unit;

			// regex
			const point = '(\\.|,)';

			this.input_validation_regex = new RegExp(`^ *(-|\\+)?((\\d*(${point}\\d${this.options.decimals?`{0,${this.options.decimals}}`:'*'})?)|(\\d+(${point}\\d${this.options.decimals?`{0,${this.options.decimals}}`:'*'})?|(${point}\\d${this.options.decimals?`{0,${this.options.decimals}}`:'*'}))((E|e)(-|\\+)?\\d*)?) *(${quantity.unit_formatted_short})? *$`);
			this.input_validation_regex_complete = new RegExp(`^ *(-|\\+)?(\\d*${point}?)?\\d${this.options.decimals?`{0,${this.options.decimals}}`:'+'}((E|e)(-|\\+)?\\d+)? *(${quantity.unit_formatted_short})? *$`);

		}


		// TODO
		protected override convertFromInputValue(input_value:string): Quantity<U> {
			let str_norm = input_value.replace(",","."); // support "," as value separator
			let elements = str_norm.match(/(-?[\d.]+) ?(\D+)?/);
			// Fall back to original, if presented with very bad input
			if (!elements) return super.value;

			let [_, v, u] = elements;
			// Check if unit is correct
			if (u) {
				try {
					let newQuant = new Quantity(v,u)
					if (this.options.permittedUnits) {
						// only update unit, if it is permitted
						for (let permittedUnit of this.options.permittedUnits){
							if (newQuant.hasSameDimension(permittedUnit))
								return newQuant;
						}
					} else {
						// every unit is permitted, so update quantity
						return newQuant;
					}
				}catch (e){}
			}
			
			// if unit is not correct (could not be parsed, not allowed) reuse old
			return new Quantity(v, super.value.unit);
		}

		protected convertNumberToValue(value: number): Datex.Quantity<U> {
			return new Datex.Quantity(value, this.unit);
		}
		protected convertValueToNumber(value: Datex.Quantity<U>): number {
			return value.value;
		}
		protected shortValue(value: Datex.Quantity<U>): string {
			return value.toString(Datex.Quantity.Formatting.NO_UNIT, this.options.decimals);
		}

	}

	@Element
	export class DateInput extends ValueInput<Time> {

		constructor(value?:Datex.CompatValue<Time>, options?:ValueInput.Options) {
			super(value, "date", options);
		}

		protected override convertFromInputValue(input_value:string):Time {
			return new Time(input_value);
		}

		protected override setInputValue(input: HTMLInputElement, value:Time) {
			input.valueAsDate = value;
		}
	} 

	@Element
	export class FileInput extends ValueInput<Blob[]> {

		constructor(value?:Datex.CompatValue<Blob[]>, options?:ValueInput.Options) {
			super(value, "file", options);
		}
		
	}
	
	// TODO SI-Number

	// horizontal percentage bar, default range 0-1
	@Element
	export class PercentageBar extends Value<number|bigint> {

		#outer:HTMLDivElement
		#container:HTMLDivElement
		#percentage:HTMLDivElement

		constructor(value:Datex.CompatValue<number|bigint>, public min:number=0, public max:number=1, public color?:Datex.CompatValue<string>) {
			super();
			if (this.wasLoadedStatic) return;

			this.#outer = document.createElement("div");

			this.#outer.style.display = "flex"
			this.#outer.style.alignItems = "center"
			this.#outer.style.width = "100%";
			this.#outer.style.height = "100%";

			this.#container = document.createElement("div");
			this.#container.style.width = "100%";
			this.#container.style.height = "50px";
			this.#container.style.borderRadius = "5px";
			this.#container.style.backgroundColor = "#ffffff05";
			this.#container.style.position = "relative";

			this.#percentage = document.createElement("div");
			this.#percentage.style.width = "50%";
			this.#percentage.style.height = "50px";
			this.#percentage.style.borderRadius = "5px";
			this.#percentage.style.backgroundColor = "var(--text)";
			this.#percentage.style.position = "relative";
			this.#percentage.style.transitionProperty = "width, background-color";
			this.#percentage.style.transitionDuration = "0.5s";

			this.#container.append(this.#percentage);
			this.#outer.append(this.#container);
			this.append(this.#outer);

			this.value = value;
		}

		protected onValueChanged(value: number | bigint): void {
			const percent = Math.max(0, Math.min(1, (globalThis.Number(value)-this.min) / (this.max-this.min)));
			this.#percentage.style.width = (100 * percent) + "%";
			HTMLUtils.setCSSProperty(this.#percentage, 'background-color', this.color);
		}
	}

	

	@Element
	export class PercentSlider extends Value<number> {
		
		#number:HTMLSpanElement
		#up:HTMLButtonElement
		#down:HTMLButtonElement

		onValueChanged(value: number) {
			if (!this.#number) return;
			this.#number.innerText = Math.round(globalThis.Number(value)*100)+"%";
		}

		constructor(value: Datex.CompatValue<number>){
			super();
			if (this.wasLoadedStatic) return;

			// own style
			this.style.position = "relative";
			this.style.display = "flex";
			this.style.justifyContent = "center";
			this.style.alignItems = "center";
			this.style.flexDirection = "column";

			this.#number = document.createElement("span");
			this.#number.style.color = "var(--text_highlight)";
			this.#number.style.fontSize = "20px";
			this.#number.innerText = "100%";

			this.#up = document.createElement("button");
			this.#up.style.background = "none"
			this.#up.style.color = "var(--text)";
			this.#up.style.fontSize = "30px";
			this.#up.style.border = "none";
			this.#up.style.cursor = "pointer";
			this.#up.style.transform = "rotate(-90deg)"

			this.#up.innerHTML = "❱"

			this.#down = document.createElement("button");
			this.#down.style.background = "none"
			this.#down.style.color = "var(--text)";
			this.#down.style.fontSize = "30px";
			this.#down.style.border = "none";
			this.#down.style.cursor = "pointer";
			this.#down.style.transform = "rotate(90deg)"

			this.#down.innerHTML = "❱"

			this.append(this.#up);
			this.append(this.#number);
			this.append(this.#down);

			this.value = value;

			// down button listener:
			let timer1:number;
			const listener1 = () => {
				timer1 = setInterval(()=>{
					if (this.value <= 0) this.value = 0;
					else this.value = this.value - 0.01;
				}, 30);
			};
			this.#down.addEventListener("mousedown", listener1);
			this.#down.addEventListener("touchstart", listener1, {passive:true});

			function downEnd1() {clearInterval(timer1)}
			window.addEventListener("mouseup", downEnd1);
			window.addEventListener("touchend", downEnd1);

			// up button listener:
			let timer2;
			const listener2 = () => {
				timer2 = setInterval(()=>{
					if (this.value >= 1) this.value = 1;
					else this.value = this.value + 0.01;
				}, 30);
			};
			this.#up.addEventListener("mousedown", listener2);
			this.#up.addEventListener("touchstart", listener2, {passive:true});

			function downEnd2() {clearInterval(timer2)}
			window.addEventListener("mouseup", downEnd2);
			window.addEventListener("touchend", downEnd2);
		}
		

	}

	@Element
	export class ColorWheel extends Value<bigint|number|`#${string}`> {

		private canvas: HTMLCanvasElement
		private context: CanvasRenderingContext2D

		private container = document.createElement("div");

		private brightness = decimal(0.3);
		private brightness_input: PercentSlider

		private outerRadius = 100
		private height = this.outerRadius*2
		private width = this.outerRadius*2

		private innerRadius = 70

		private selectorRadius = (this.outerRadius - this.innerRadius) / 2
		private selectorDistance = this.innerRadius + this.selectorRadius;

		private arcPosition = Math.PI;
		private color_type:"int"|"hex" = "int"

		private angleShift = !!globalThis.chrome ? 0 : Math.PI/2; // TODO update; fix because of chrome concicGradient bug

		onValueChanged() {
			this.update();
		}

		constructor(color:Datex.CompatValue<bigint|number|`#${string}`>) {
			super();
			if (this.wasLoadedStatic) return;

			this.container.style.position = "relative"
			this.container.style.display = "flex"
			this.container.style.width = "fit-content"
			this.container.style.height = "fit-content"

			this.append(this.container)

			this.canvas = document.createElement("canvas");
			this.context = this.canvas.getContext("2d");
			this.container.append(this.canvas);

			const _div = document.createElement("div");
			this.brightness_input = new PercentSlider(this.brightness);

			// update color when brightness changed
			this.brightness.observe(()=>this.value = this.getColorFromArcPosition());

			_div.style.position = "absolute";
			_div.style.display = "flex";
			_div.style.alignItems = "center";
			_div.style.justifyContent = "center";
			_div.style.width = this.width+"px";
			_div.style.height = this.height+"px";
			_div.style.left = "0";
			_div.style.top = "0";
			_div.style.pointerEvents = "none";
			this.brightness_input.style.pointerEvents = "all";

			_div.append(this.brightness_input);
			this.container.append(_div);

			this.canvas.style.width = this.width+"px";
			this.canvas.style.height = this.height+"px";
			this.canvas.style.borderRadius = "50%";
			this.canvas.width = this.width*2;
			this.canvas.height = this.height*2;

			this.context.scale(2, 2);

			// @ts-ignore
			if (this.angleShift) {
				this.context.translate(this.width/2, this.height/2);
				this.context.rotate(this.angleShift);
				this.context.translate(-this.width/2, -this.height/2);
			}
			

			this.initListeners();
			this.draw();

			this.value = color;
			// update brightness value for color
			this.brightness.val = Utils.getBrightnessFromColor(this.value);
		}

		private initListeners(){
			let moving = false;

			// add event listeners for user actions

			function mouseDownListener(){
				moving = true;
			}
			function mouseUpListener(e:MouseEvent){
				mouseMoveListener(e);
				moving = false;
			}

			const mouseMoveListener = (e:MouseEvent|TouchEvent)=>{
				if (moving) {

					let offsetX, offsetY;
					if (globalThis.TouchEvent && e instanceof TouchEvent) {
						if (!e.touches[0]) return;
						const {x, y, width, height} = this.canvas.getBoundingClientRect();
						offsetX = (e.touches[0].clientX-x)/width*this.canvas.offsetWidth;
						offsetY = (e.touches[0].clientY-y)/height*this.canvas.offsetHeight;
					}
					else if (e instanceof MouseEvent){
						const {x, y, width, height} = this.canvas.getBoundingClientRect();
						offsetX = (e.clientX-x)/width*this.canvas.offsetWidth;
						offsetY = (e.clientY-y)/height*this.canvas.offsetHeight;
					}

					this.arcPosition = Math.atan2(offsetY-this.outerRadius, offsetX-this.outerRadius)

					// get new color
					this.value = this.getColorFromArcPosition();
				}
			}

			this.canvas.addEventListener("mousedown", mouseDownListener)
			this.canvas.addEventListener("touchstart", mouseDownListener, {passive:true})

			window.addEventListener("mouseup", mouseUpListener)
			window.addEventListener("touchend", mouseUpListener)

			window.addEventListener("mousemove", mouseMoveListener)
			window.addEventListener("touchmove", mouseMoveListener)
		}

		private update(){
			this.color_type = typeof this.value == "string" ? "hex" : "int"
			this.setArcPositionFromColor(this.value);
			// this.setAttribute("value",this.value?.toString());
			this.draw();

			// update brightness value for color
			this.brightness.val = Utils.getBrightnessFromColor(this.value);
		}

		private draw(){
			this.drawBackground();
			this.drawSelector();
		}

		private drawBackground(){
			this.context.clearRect(0, 0, this.width, this.height);

			let gradient = this.context.createConicGradient(0, this.outerRadius, this.outerRadius);
			gradient.addColorStop(0, "rgb(255, 0, 0)");
			gradient.addColorStop(0.15, "rgb(255, 0, 255)");
			gradient.addColorStop(0.33, "rgb(0, 0, 255)");
			gradient.addColorStop(0.49, "rgb(0, 255, 255)");
			gradient.addColorStop(0.67, "rgb(0, 255, 0)");
			gradient.addColorStop(0.84, "rgb(255, 255, 0)");
			gradient.addColorStop(1, "rgb(255, 0, 0)");

			this.context.fillStyle = gradient; 
			this.context.fillRect(0, 0, this.width, this.height);

			/* inner circle */
			this.context.beginPath()
			this.context.globalCompositeOperation = 'destination-out'
			this.context.arc(this.outerRadius, this.outerRadius, this.innerRadius, 0, 2 * Math.PI, false)
			this.context.fill()
		}


		private drawSelector(){
			const x = this.selectorDistance * Math.cos(this.arcPosition-this.angleShift) + this.outerRadius;
			const y = this.selectorDistance * Math.sin(this.arcPosition-this.angleShift) + this.outerRadius;

			const ring_width = 8;

			this.context.beginPath()
			this.context.globalCompositeOperation = 'source-over'
			this.context.strokeStyle = "#ffffff";

			const color = Datex.Value.collapseValue(this.value, true, true);
			if (typeof color == "string") this.context.fillStyle = color;
			else this.context.fillStyle = Utils.intToHex(color);

			this.context.lineWidth = ring_width;
			this.context.arc(x,y, this.selectorRadius-ring_width/2, 0, 2 * Math.PI, false)
			this.context.stroke()
			this.context.fill()

		}

		// color conversion

		private setArcPositionFromColor(color:`#${string}`|number|bigint) {
			if (this.brightness.val == 0) return; // don't update angle, would always be 0
			
			let rgb:[number,number,number]
			if (typeof color == "string") rgb = Utils.hexToRgb(color);
			else rgb = Utils.intToRgb(color);

			let hsl = Utils.rgbToHsl(...rgb);
			this.arcPosition = (1-hsl[0])*(2*Math.PI);
		}


		private getColorFromArcPosition(type:"hex"|"int" = this.color_type):number|`#${string}` {
			let arc = this.arcPosition;
			if (arc < 0) arc = 2*Math.PI + arc;

			let rgb = Utils.hslToRgb(1 - arc/(2*Math.PI), 1, this.brightness.val);

			if (type == "hex") return Utils.rgbToHex(...rgb);
			else return Utils.rgbToInt(...rgb);
		}
	}


	// for any value that is a iterable value of values
	// T is input entry type, MT is output entry type
	export abstract class IterableValue<T, MT=T, O extends Base.Options = Base.Options> extends Value<Iterable<T>, O> {

		constructor(list?: Datex.CompatValue<Iterable<T>>, options?: O) {
			super(undefined, options);
			if (this.wasLoadedStatic) return;
			this.value = list;
			this.checkEmpty();
		}

		#entries?: Map<number, MT>;
		protected get entries() {
			if (!this.#entries) this.#entries = new Map<number, MT>();
			return this.#entries;
		}

		private isPseudoIndex(){
			return !(this.value instanceof Array)
		}

		// for map etc. shift entries to fill from start
		//    1=>x 3=>y 4=>z
		// to 1=>x 2=>y 3=>z
		private shiftEntries(key:number){
			const max = [...this.entries.keys()].at(-1);
			if (key > max) return;
			for (let k = key; k<max; k++) {
				this.entries.set(k, this.entries.get(k+1))
			}
			this.entries.delete(max);
		}

		private deleteEntry(key:number) {
			if (this.isPseudoIndex()) this.shiftEntries(key); // for map etc. shift entries to fill from start
			else this.entries.delete(key)
		}

		// pseudo keys for Sets, Maps and Objects which have no index
		private getPseudoIndex(value:T) {
			if (this.value instanceof Set) return [...this.value].indexOf(value);
			if (this.value instanceof Map) return [...this.value.values()].indexOf(value);
			if (this.value instanceof Object) return [...Object.values(this.value)].indexOf(value);
		}

		// pseudo keys for Sets which have no index
		protected iterator(iterable:Set<any>|Map<any,any>|Object|Array<any>) {
			if (iterable instanceof Set) return iterable;
			if (iterable instanceof Array) return iterable;
			if (iterable instanceof Map) return iterable.entries();
			if (iterable instanceof Object) return Object.entries(iterable);
		}

		protected onValueChanged(value: Iterable<T>|T, key: number|undefined, type:Datex.Value.UPDATE_TYPE) {

			if (type == Datex.Value.UPDATE_TYPE.DELETE) return; // ignore DELETE event, only use BEFORE_DELETE event

			// compatibility with key-value iterables
			// Map or Object
			if (type != Datex.Value.UPDATE_TYPE.INIT && type != Datex.Value.UPDATE_TYPE.CLEAR && (this.value instanceof Map || !(this.value instanceof Set || this.value instanceof Array))) {
				const original_value = value;
				value = <Iterable<T>>[key, value]
				key = this.getPseudoIndex(<T>original_value)
				if (key == -1) throw new ValueError("IterableValue: value not found in iterable")
			}

			// single property update
			if (type == Datex.Value.UPDATE_TYPE.SET) this.handleNewEntry(<T>value, key)
			else if (type == Datex.Value.UPDATE_TYPE.ADD) this.handleNewEntry(<T>value, this.getPseudoIndex(<T>value));
			// property removed
			else if (type == Datex.Value.UPDATE_TYPE.CLEAR) {
				for (const [key,] of this.#entries??[]) {
					this.handleRemoveEntry(key);
				}
			}
			else if (type == Datex.Value.UPDATE_TYPE.BEFORE_DELETE) this.handleRemoveEntry(key);
			else if (type == Datex.Value.UPDATE_TYPE.REMOVE) this.handleRemoveEntry(this.getPseudoIndex(<T>value));
			// completely new value
			else if (type == Datex.Value.UPDATE_TYPE.INIT) {
				for (const e of this.entries.keys()) this.handleRemoveEntry(e); // clear all entries
				let key = 0;
				for (const child of <Iterable<T>>this.iterator(value??[])) this.handleNewEntry(child, key++);
			}
		}

		// can be overriden
		protected valueToEntry(value:T, key?:number):MT {
			return <MT><any>value;
		}

		// call valueToEntry and save entry in this.#entries
		private handleNewEntry(value:T, key?:number) {
			const entry = this.valueToEntry(value, key)
			if (this.entries.has(key)) this.handleRemoveEntry(key) // entry is overridden
			this.entries.set(key, entry);
			this.onNewEntry(entry, key); // new entry handler
			this.checkEmpty();
		}

		private handleRemoveEntry(key:number) {
			const entry = this.entries.get(key);
			this.deleteEntry(key);
			this.onEntryRemoved(entry, key);
			this.checkEmpty();
		}

		private checkEmpty() {
			if (this.#entries?.size == 0) this.onEmpty();
		}

		protected abstract onNewEntry(entry:MT, key?:number):void
		protected abstract onEntryRemoved(entry: MT, key?:number):void

		// @implement
		protected onEmpty():void {}

	}

	export namespace ValueSelect {
		export interface Options extends Elements.Base.Options {
			selected_index?:Datex.CompatValue<number>,
			onChange?:(index:number, value:any)=>any|Promise<any>,
			accent_color?: Datex.CompatValue<string>
		}
	}


	@Element
	export abstract class ValueSelect<O extends ValueSelect.Options = ValueSelect.Options, V = any> extends IterableValue<string|[string,V],HTMLElement,O> {

		displayed_option_name:Datex.Value<string> 
		selected_option_index:Datex.Value<number>
		selected_option_name:Datex.Value<string>
		selected_option_value:Datex.Value<V>

		abstract options_container: HTMLElement;

		get list(){return this.value}
		set list(list:Datex.CompatValue<Iterable<string|[string,V]>>) {this.value = list}

		constructor(options?:O){
			super(undefined, options);
			if (this.wasLoadedStatic) return;

			this.displayed_option_name = text()
			this.selected_option_index = this.options.selected_index instanceof Datex.Value ? this.options.selected_index : decimal(this.options.selected_index);
		}

		// must be called in constructor
		public init(list:Datex.CompatValue<Iterable<string|[string,V]>> = []){
			// create layout
			this.createLayout();

			this.value = list;

			// index not within bounds=´?
			const size = [...this.value].length;
			if (this.selected_option_index.val >= size || this.selected_option_index.val < 0) {
				this.selected_option_index.val = 0;
			}

			this.selected_option_name = transform([this.selected_option_index], (i):string=>typeof this.value[i] == "string" ? this.value[i] :this.value[i]?.[0])
			this.selected_option_value = transform([this.selected_option_index], i=>this.value[i] instanceof Array ? this.value[i]?.[1] : this.value[i]);
			// update to show initial option
			this.displayed_option_name.val = this.selected_option_name;

			if (this.options.onChange instanceof Function) Datex.Value.observe(this.selected_option_index, ()=>{
				this.options.onChange!(this.selected_option_index.val, this.selected_option_value.val);
			})

			// listen for changes of this.selected_option_name and update displayed_option_name accordingly (if triggered externally)
			Datex.Value.mirror(this.selected_option_name, this.displayed_option_name);
		}

		protected abstract createLayout():void
		protected abstract generateOptionHTMLElement(element: string, key:number, value?:V): HTMLElement


		override valueToEntry(value:string|[string,V], key:number): HTMLElement {
			if (value instanceof Array) return this.generateOptionHTMLElement(value[0], key, value[1]);
			else if(typeof value == "string") return this.generateOptionHTMLElement(value,key);
			else throw new Datex.TypeError("Invalid Dropdown Menu entry type");
		}
		

		protected onEntryRemoved(entry: HTMLElement, key: number) {
			entry?.remove();

			// selected entry removed?
			if (this.selected_option_index.val == key) {
				if (this.entries.has(key-1)) this.selected_option_index.val = key - 1;
			}
		}

		protected onNewEntry(element: HTMLElement, key:number) {
			
			// replace existing option
			if (this.children.length-1 > key) {
				this.options_container.replaceChild(element, this.options_container.children[key+1]);
			}
			// append at the end
			else this.options_container.append(element)
			
		}
	}

	export namespace DropdownMenu {
		export interface Options extends Elements.ValueSelect.Options {
			title?:Datex.CompatValue<string>
		}
	}


	@Element
	export class DropdownMenu extends ValueSelect<DropdownMenu.Options> {
		options_container: HTMLElement;

		#expanded = false;
		#outer_div: HTMLDivElement 
		#selected_div: HTMLSpanElement 
		#title_el: HTMLSpanElement 
		#icon:HTMLElement

		#placeholder_item: HTMLDivElement
		#title_size:Datex.Value<string>


		constructor(list:Datex.CompatValue<Iterable<string|[string,any]>> = [], options?:DropdownMenu.Options){
			super(options);
			if (this.wasLoadedStatic) return;
			this.init(list)
		}

		createLayout(){

			this.options_container = document.createElement("div");
			this.options_container.classList.add("dropdown-expand")
			HTMLUtils.setCSSProperty(this.options_container, "--accent-color", this.options.accent_color ?? Theme.getColorReference('accent'))
			this.options_container.style.visibility = "hidden";

			this.#outer_div = HTMLUtils.setCSS(document.createElement("div"), {position:'relative'});
			this.#selected_div = HTMLUtils.setCSS(document.createElement("span"), {'text-align':'center', width:'100%', 'margin-left':'4px', 'white-space':'nowrap'})

			const title_container = document.createElement("div");
			title_container.classList.add("dropdown");
			title_container.style.pointerEvents = "all";
			this.#title_el = document.createElement("span");
			this.#title_el.style.whiteSpace = "nowrap";
			HTMLUtils.setElementText(this.#title_el, this.options.title??' ');
			title_container.append(this.#title_el);
			if (this.options.title?.toString().length) title_container.append(":")
			title_container.append(this.#selected_div);
			this.#icon = HTMLUtils.setCSS(HTMLUtils.createHTMLElement(I`fa-caret-down`), {overflow: 'visible', 'margin-left': '5px', padding: '4px'});
			title_container.append(this.#icon);

			this.#outer_div.append(title_container);

			HTMLUtils.setElementText(this.#selected_div, this.displayed_option_name)
			HTMLUtils.setCSSProperty(this.#selected_div, "color", this.options.accent_color ?? Theme.getColorReference('accent'))

			this.append(this.#outer_div);
			document.body.append(this.options_container);

			// default element for layout TODO better solution (layout problems if no option items)
			this.#placeholder_item = document.createElement("div");
			this.#placeholder_item.classList.add("dropdown-item")
			this.#placeholder_item.innerText = "------------------------";
			this.#placeholder_item.style.height = "0px"
			this.#placeholder_item.style.visibility = "hidden"

			this.options_container.append(this.#placeholder_item)

			// listeners
			// hide on click outside
			window.addEventListener("mousedown", (e)=>{
				if (this.#expanded && !(<Element>e.target).classList?.contains("dropdown-item")) {
					e.stopPropagation()
					this.collapse()
				}
			}, true)
			window.addEventListener("blur", ()=>this.collapse())

			title_container.addEventListener("mousedown", (e)=>{
				if (!this.#expanded) {
					this.#expanded = true;

					this.#icon.style.transform = "rotate(180deg)";

					const offsetY = title_container.getBoundingClientRect().top + title_container.getBoundingClientRect().height + window.scrollY;
					const offsetX = title_container.getBoundingClientRect().left  + window.scrollX;

					this.options_container.style.top = offsetY + "px";
					this.options_container.style.left = offsetX + "px";

					this.options_container.style.visibility = "visible";
				}
				else {
					this.collapse();
				}
				e.stopPropagation();
			});

			// get current title_el size to resize expanded entries
			this.#title_size = transform([HTMLUtils.getElementSize(this.#title_el, 'x')], x=>`${x+35}px`);
			// get current expanded entries size to set title_container size
			HTMLUtils.setCSSProperty(title_container, 'width', transform([HTMLUtils.getElementSize(this.options_container, 'x')], x=>`${x}px`))

		}

		protected generateOptionHTMLElement(entry: string, key:number) {

			let option_div = document.createElement("div");
			option_div.classList.add("dropdown-item")
			HTMLUtils.setCSSProperty(option_div, "padding-right", this.#title_size);
			HTMLUtils.setElementText(option_div, entry);

			// temporarily display current entry name
			option_div.addEventListener("mouseenter", ()=>{
				this.displayed_option_name.val = entry;
			})
			// reset displayed entry name to previously selected
			option_div.addEventListener("mouseout", ()=>{
				this.displayed_option_name.val = this.selected_option_name;
			})
			// set selected entry
			option_div.addEventListener("mousedown", (e)=>{
				this.selected_option_index.val = key;
				this.collapse();
				e.stopPropagation();
			})

			return option_div;
		}
		
		protected collapse(){
			this.#expanded = false;
			this.options_container.style.visibility = "hidden";
			this.#icon.style.transform = "";
		}

	}


	@Element
	export class RadioSelectMenu extends ValueSelect {
		options_container: HTMLElement;

		#group_name = Utils.getUniqueElementId();

		constructor(list:Datex.CompatValue<Iterable<string|[string,any]>> = [], options?:ValueSelect.Options){
			super(options);
			if (this.wasLoadedStatic) return;
			this.init(list)
		}

		createLayout(){

			this.options_container = document.createElement("div");
			HTMLUtils.setCSSProperty(this.options_container, "--accent-color", this.options.accent_color ?? Theme.getColorReference('accent'))
			
			this.append(this.options_container)
		}

		protected generateOptionHTMLElement(entry: string, key:number) {

			const div = document.createElement("div");

			const id = Utils.getUniqueElementId();
			const input = document.createElement("input");
			input.setAttribute("type", "radio");
			input.setAttribute("id", id);
			input.setAttribute("name", this.#group_name);

			const label = document.createElement("label"); 
			label.setAttribute("for", id);
			HTMLUtils.setElementText(label, entry);

			div.append(input)
			div.append(label)


			input.addEventListener('change', (e) => {
				if (input.checked) {
					this.selected_option_index.val = key;
				}
			});

			return div;
		}

	}


	// List of values

	export namespace ValueList {
		export interface Options<T=any> extends Elements.Base.Options {
			column_widths?: string[],
			auto_width?: boolean,
			max?:number,
			header?: (string|HTMLElement)[],
			onClick?: (selected: T)=>void,
			plain?: boolean // plain layout, minimal css
		}
	}

	@Element
	export class ValueList<T> extends IterableValue<T,(HTMLElement|string)[],ValueList.Options<T>> {
		
		#current_index = 0;
		#selected_index = 0;
		#transform?: (value:T, index:number)=>(HTMLElement|string)[]
		#entry_doms: HTMLDivElement[] = []

		#list_container: HTMLElement

		override valueToEntry(value:T) {
			if (this.#transform instanceof Function) {
				return this.#transform(<T>value, this.#current_index);
			}
			else {
				if (value instanceof Array) return value;
				else return [value];
			}
		}

		#elements = new Map<number, HTMLElement>()

		protected onEntryRemoved(entry:(HTMLElement|string)[], key: number) {
			this.#elements.get(key)?.remove();
			this.#elements.delete(key);
		}

		onNewEntry(entry: Datex.CompatValue<(HTMLElement|string)>[], key:number){
			const index = this.#current_index;
			this.#current_index++;

			const entry_dom = document.createElement("div");
			entry_dom.classList.add('list-entry');
			if (this.options.plain) entry_dom.classList.add('plain');

			entry_dom.setAttribute('tabindex','-1')

			this.#entry_doms.push();
	
			let i = 0;
			for (const e of entry) {
				const container = document.createElement("div");
				container.classList.add('list-entry-value');
				const val = Datex.Value.collapseValue(e,true,true);
				if (val instanceof HTMLElement) {
					const div = document.createElement("div");
					HTMLUtils.setElementHTML(container, <Datex.CompatValue<HTMLElement>>e)
					container.append(div);
				}
				else if (typeof val == "string") HTMLUtils.setElementText(container, <Datex.CompatValue<string>>e)

				if (this.options.column_widths&&this.options.column_widths[i]) container.style.width = this.options.column_widths[i];


				entry_dom.append(container);
				i++;
			}
	
			this.#elements.set(key, entry_dom)
			this.#list_container.append(entry_dom)
	
			entry_dom.addEventListener("click", ()=>{
				this.selectEntry(index);
				this.clickEntry(index);
			})
		}

		#addHeader(){
			const header_dom = document.createElement("div");
			header_dom.classList.add('list-entry');
			if (this.options.plain) header_dom.classList.add('plain');

			let i = 0;
			for (const e of this.options.header??[]) {
				const container = document.createElement("div");
				container.classList.add('list-entry-value')
				container.classList.add('header')
				if (e instanceof HTMLElement) container.append(e);
				else container.innerText = e;
				header_dom.append(container);
				i++;
			}
	
			this.#list_container.append(header_dom)
		}


		constructor(list:Datex.CompatValue<Iterable<T>>, options?:ValueList.Options, transform?:(value:T, index:number)=>(HTMLElement|string)[]){
			super(undefined, options);
			if (this.wasLoadedStatic) return;
			this.#transform = transform;

			this.style.display = "block";

			this.#list_container = document.createElement("div");
			this.#list_container.classList.add('list-container');
			this.#list_container.setAttribute("tabindex", "0");

			if (this.options.auto_width) this.#list_container.style.tableLayout = "auto";
	
			this.#list_container.addEventListener("keydown",  e => {
				if (e.key == "ArrowUp" || (e.key == "Tab" && e.shiftKey)) this.selectPrevious()
				else if (e.key == "ArrowDown" || e.key == "Tab") this.selectNext()
				else return;
				e.preventDefault();
			})

			if (options?.header) this.#addHeader();

			this.append(this.#list_container);

			this.value = list;

		}

		selectEntry(index:number):boolean {
			if (!this.#entry_doms[index]) return false;
			this.#selected_index = index;
			for (const entry of this.querySelectorAll('.list-entry')) entry.classList.remove('active');
			this.#entry_doms[index].classList.add("active");
			return true;
		}

		clickEntry(index:number) {
			const iterable = [...this.iterator(this.value)]

			if (!(index in iterable)) return;
			if (this.options.onClick) {
				this.options.onClick(iterable[index]);
			}
		}
	
		selectNext():boolean{
			return this.selectEntry(this.#selected_index+1)
		}
		selectPrevious():boolean{
			return this.selectEntry(this.#selected_index-1)
		}
		selectLast():boolean{
			return this.selectEntry(this.#entry_doms.length-1)
		}

	}

}

