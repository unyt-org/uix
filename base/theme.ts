import { Datex, $$,  f, static_pointer } from "unyt_core"
import { IS_HEADLESS } from "../utils/constants.ts"

const logger = new Datex.Logger("uix theme");

interface ThemeProperties {
	__name?:string,

	text?: string
	text_light?: string // weaker color
	text_highlight?: string // stronger color
	border?: string

	bg_default?: string // element bg
	bg_dark?: string // page bg
	bg_button?: string // button bg
	bg_input?: string // intpu bg
	bg_hover?: string  // on hover (e.g tab headers)
	bg_focus?: string  // on focus
	bg_overlay?: string  // overlay bg, e.g. context menu
	bg_content?: string // e.g. tables
	bg_content_hlt?: string // content highlight bg
	bg_content_dark?: string
	bg_content_edit?: string // currently edited content (textarea, div)
	bg_code?: string // for <code> / monaco
	bg_console?: string // for ConsoleView
	bg_loading?: string // for loading screen

	grey_blue?: string
	light_blue?: string
	purple?: string
	green?: string
	red?: string
	dark_red?: string
	blue?: string,
	orange?: string,
	yellow?:string,

	accent?:string, // accent color

	// variable types
	code_string_color?: string
	code_number_color?: string
	code_boolean_color?: string
	code_buffer_color?: string,
}

export class Theme  {
	static LIGHT = {
		__name: "uix-light",
		text: "#333333",
		text_light: "#333333aa",
		text_highlight: "#171616",

		bg_default: "#f2efef",
		bg_dark: "#ffffff",
		bg_loading: "#eeeeee",
		bg_button: "#dddddd",
		bg_input: "#ededed",
		bg_hover: "#C7C7C7",
		bg_focus: "#cdcdcd",
		bg_overlay: "#eeeeee",
		bg_content: "#fefefe",
		bg_content_hlt: "#dddddd",
		bg_content_dark: "#f0f0f0",
		bg_content_edit: "#585E68bb",
		bg_code: "#16161a",
		bg_console: "#dedede",

		border: "#d4d1d1",

		code_string_color: "#b781e3",
		code_number_color: "#fd8b19",
		code_boolean_color: "#e32d84",
		code_buffer_color: "#ee5f5f",

		grey_blue: "#e0e1f4",
		light_blue: "#3097db",
		purple: "#c470de",
		green: "#1eda6d",
		red: "#ea2b51",
		dark_red: "#c53434",
		blue: "#0669c1",
		orange: "#ea5e2b",
		yellow: "#ebb626",

		accent: "#3097db"
	}

	static DARK = {
		__name: "uix-dark",
		text: "#ababab",
		text_light: "#ababab80",
		text_highlight: "#efefef",

		bg_default: "#1a1e2a", // #1a1e2a94
		bg_dark: "#0e131f",
		bg_loading: "#111111",
		bg_button: "#292d39",
		bg_input: "#292d39",
		bg_hover: "#3a3f4699",
		bg_focus: "#3a3f46cc",
		bg_overlay: "#171717",
		bg_content: "#212731",
		bg_content_hlt: "#2e3540",
		bg_content_dark: "#0f111b",
		bg_content_edit: "#333538cc",
		bg_code: "#16161a",
		bg_console: "#111111",

		border: "#3d414d",

		code_string_color: "#b781e3",
		code_number_color: "#fd8b19",
		code_boolean_color: "#e32d84",
		code_buffer_color: "#ee5f5f",

		grey_blue: "#272838",
		light_blue: "#4FA9E8",
		purple: "#c470de",
		green: "#1eda6d",
		red: "#ea2b51",
		dark_red: "#c53434",
		blue: "#0669c1",
		orange: "#ea5e2b",
		yellow: "#ebb626",

		accent: "#4FA9E8"
	}

	static #colors:{[key:string]:string} = <{[key:string]:string}>static_pointer({}, f('@@000000000000000000000000'), 1234, "$uix_colors"); // label("$uix_colors", {});

	static #current_style = "flat";
	static #style_handlers:Map<string,(element:HTMLElement)=>void> = new Map();
	static #current_mode:Datex.Pointer<"dark"|"light"> = static_pointer(window.matchMedia?.('(prefers-color-scheme: dark)').matches ? "dark" : "light", f('@@000000000000000000000000'), 1236, "$uix_mode");
	static #transition_mode:Datex.Pointer<"dark"|"light">|undefined;
	static #current_light_theme:ThemeProperties = this.LIGHT;
	static #current_dark_theme:ThemeProperties = this.DARK;
	static #auto_mode = true;

	static #current_theme_style_sheet = new window.CSSStyleSheet();
	static #current_theme_style_sheet_added = false;

	static #global_style_sheet = new window.CSSStyleSheet();
	static #global_style_sheet_added = false;

	static get stylesheet() {return this.#global_style_sheet}

	static get mode() {return this.#transition_mode ?? this.#current_mode}
	static get style() {return this.#current_style}

	static get colors() {return this.#colors}

	static get auto_mode() {return this.#auto_mode}
	static set auto_mode(auto_mode:boolean) {this.#auto_mode = auto_mode}

	// add a new light theme (updates immediately if current mode is light)
	public static setLightTheme(theme:{[key:string]:any}) {
		this.#current_light_theme = theme
		if (theme.__name) this.addGlobalThemeClass(theme.__name, theme);
		if (this.#current_mode.val == "light") this.update(this.#current_light_theme, "light");
	}

	// add a new light theme (updates immediately if current mode is dark)
	public static setDarkTheme(theme:{[key:string]:any}) {
		this.#current_dark_theme = theme
		if (theme.__name) this.addGlobalThemeClass(theme.__name, theme);
		if (this.#current_mode.val == "dark") this.update(this.#current_dark_theme, "dark");
	}

	// (force) update theme to dark or light mode
	public static setMode(_mode:Datex.CompatValue<"dark"|"light">, force_update = false, persist = true) {
		const mode = Datex.Value.collapseValue(_mode, true, true);
		if (!force_update && this.#current_mode.val == mode) return;
		else {
			if (persist) this.#auto_mode = false; // keep theme even if os changes theme
			logger.debug("mode changed to " + mode);
			this.update(mode == "dark" ? this.#current_dark_theme : this.#current_light_theme, mode);

			// css global color scheme
			if (!IS_HEADLESS) document.body.style.colorScheme = mode;
		}
	}

	public static setStyleHandler(style:string, handler:(element:HTMLElement)=>void) {
		this.#style_handlers.set(style, handler);
	}

	// update style
	public static setStyle(style:string) {
		logger.debug("style changed to " + Theme.mode);
		this.#current_style = style;
	}

	// apply style to a component
	public static applyStyle(element:HTMLElement, style=this.style) {
		if (this.#style_handlers.has(style)) {
			this.#style_handlers.get(style)(element);
		}
	}

	static #current_theme_css_text = ""
	static #global_themes_css_text = ""

	static getCSSSnapshot(){
		return `${this.#current_theme_css_text}\n${this.#global_themes_css_text}`
	}

	// update the current theme (changes immediately)
	private static update(theme:ThemeProperties, mode:"dark"|"light") {
		this.#transition_mode = $$(mode); // don't trigger Theme.mode observers yet with this.#current_mode, but Theme.mode already updated

		let text = ":root{";
		// iterate over all properties (also from inherited prototypes)
		// TODO only iterate over allowed properties?
		const added_properties = new Set();
		for (let o = theme; o && o != Object.prototype; o = Object.getPrototypeOf(o)) {
			for (const [key, value] of Object.entries(o)) {
				if (added_properties.has(key)) continue;
				added_properties.add(key);
				if (key == '__name') continue;
				this.#colors[key] = value;
				text += `--${key}: ${value};` // TODO escape?
			}
		}

		text += "}";
		this.#current_theme_css_text = text;

		this.updateCurrentThemeStyle()

		this.#current_mode.val = mode; // only now trigger Theme.mode observers
		this.#transition_mode = undefined;

		// call them change listeners
		for (const observer of this.mode_change_observers) observer(mode);
	}

	private static addGlobalThemeClass(name:string, theme:ThemeProperties) {
		let text = `.theme-${name} {`;
		// iterate over all properties (also from inherited prototypes)
		// TODO only iterate over allowed properties?
		const added_properties = new Set();
		for (let o = theme; o && o != Object.prototype; o = Object.getPrototypeOf(o)) {
			for (const [key, value] of Object.entries(o)) {
				if (added_properties.has(key)) continue;
				added_properties.add(key);
				if (key == '__name') continue;
				text += `--${key}: ${value};` // TODO escape?
			}
		}

		text += "}";

		this.#global_themes_css_text += text;

		this.updateGlobalThemeStyle()
	}

	private static updateCurrentThemeStyle(){
		this.#current_theme_style_sheet.replaceSync?.(this.#current_theme_css_text);

		// add to document
		if (!this.#current_theme_style_sheet_added) {
			if (!IS_HEADLESS) document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.#current_theme_style_sheet, this.#global_style_sheet];
			this.#current_theme_style_sheet_added = true;
		}
	}

	private static updateGlobalThemeStyle(){
		this.#global_style_sheet.replaceSync?.(this.#global_themes_css_text);

		// add to document
		if (!this.#global_style_sheet_added) {
			if (!IS_HEADLESS) document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.#current_theme_style_sheet, this.#global_style_sheet];
			this.#global_style_sheet_added = true;
		}
	}

	// create new theme based on another theme
	static extend<T extends object = object>(theme:ThemeProperties, name:string, extensions:T): T{
		const new_theme = Object.create(theme);
		for (let [key, value] of Object.entries(extensions)) {
			new_theme[key] = value;
		}
		new_theme.__name = name;
		return new_theme;
	}

	static setColor(name:keyof ThemeProperties|string, value:string) {
		console.log("set theme property " + name +" to:", value);
		this.#colors[name] = value;
		document.documentElement.style.setProperty('--'+name, value);
	}

	static getColor(name:keyof ThemeProperties|string) {
		return this.#colors[name];
	}

	static getColorReference(name:string){
		return Datex.PointerProperty.get(this.#colors, name)
	}

	static collapseColorToCss(color:Datex.CompatValue<string>) {
		if (color instanceof Datex.PointerProperty && color.pointer.val == Theme.colors) {
			return `var(--${color.key})`; // css variable
		}
		else {
			return Datex.Value.collapseValue(color, true, true);
		}
	}

	private static mode_change_observers = new Set<Function>();
	static onModeChange(observer:(theme:"dark"|"light")=>void) {
		this.mode_change_observers.add(observer);
	}
}

Theme.addGlobalThemeClass(Theme.DARK.__name, Theme.DARK);
Theme.addGlobalThemeClass(Theme.LIGHT.__name, Theme.LIGHT);

Theme.setMode(Theme.mode, true, false)