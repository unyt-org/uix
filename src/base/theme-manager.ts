import { client_type } from "datex-core-legacy/utils/constants.ts";
import { Theme, defaultThemes } from "./theme.ts";
import { UIX_COOKIE, getCookie, setCookie } from "../session/cookies.ts";
import type { CSSStyleSheet } from "../uix-dom/dom/deno-dom/src/css/CSSStylesheet.ts";
import { Logger } from "datex-core-legacy/utils/logger.ts";

const logger = new Logger("uix theme");

class ThemeManager  {

	#loadedThemes = new Map<string, Theme>()

	#values:{[key:string]:string} = {}

	#auto_mode = true
	#current_theme = client_type == "browser" ? (getCookie(UIX_COOKIE.theme) ?? "uix-light") : "uix-light";
	#current_mode: "dark"|"light" = client_type == "browser" ?  
		(["dark", "light"].includes(getCookie(UIX_COOKIE.colorMode) as any) ? getCookie(UIX_COOKIE.colorMode) as "dark"|"light" : "light") :
		"light";

	#waiting_theme?: string;

	#default_light_theme = defaultThemes.light;
	#default_dark_theme = defaultThemes.dark

	readonly #current_theme_style_sheet = new CSSStyleSheet();
	#current_theme_style_sheet_added = false;

	#global_style_sheet = new CSSStyleSheet();
	#global_style_sheet_added = false;

	#themesCSS = new Map<string, string>()

	get stylesheet() {return this.#global_style_sheet}

	get mode() {return this.#current_mode}
	set mode(name: "dark"|"light") {this.setMode(name)}
	get theme() {return this.#current_theme}
	set theme(name: string) {this.setTheme(name)}

	get defaultDarkTheme() {return this.#default_dark_theme.name}
	get defaultLightTheme() {return this.#default_light_theme.name}

	get values() {return this.#values}

	get auto_mode() {return this.#auto_mode}
	set auto_mode(auto_mode:boolean) {this.#auto_mode = auto_mode}


	constructor() {
		// load themes from embedded style
		for (const sheet of document.styleSheets??[]) {
			// themes
			if ((<HTMLStyleElement>sheet.ownerNode)?.classList?.contains("uix-themes")) {
				this.addThemeFromParsedStylesheet(sheet)
			}
		}

		// add default themes if not already loaded from html
		if (!this.getTheme(defaultThemes.dark.name)) this.registerTheme(defaultThemes.dark);
		if (!this.getTheme(defaultThemes.light.name)) this.registerTheme(defaultThemes.light);

		// set current theme
		this.setTheme(this.theme, true)
	}

	public getTheme(name: string) {
		return this.#loadedThemes.get(name);
	}

	/**
	 * Register a new theme
	 * @param theme 
	 * @param useAsDefault use as default theme for dark/light mode
	 */
	public registerTheme(theme: Theme, useAsDefault = true) {
		this.#loadedThemes.set(theme.name, theme);
		this.addGlobalThemeClass(theme);
		if (useAsDefault) {
			if (theme.mode == "dark") this.#default_dark_theme = theme
			else if (theme.mode == "light") this.#default_light_theme = theme;

			// theme matches current mode, immediately apply
			if (theme.mode == this.#current_mode) this.#activateTheme(theme);
			// waited for this theme to register, use
			if (this.#waiting_theme == theme.name) this.#activateTheme(theme)
		}

	}

	/**
	 * Changes the mode to dark or light, selecting the current preferred
	 * or light theme
	 */
	public setMode(mode: "dark"|"light", force_update = false, persist = true) {
		if (!force_update && this.#current_mode == mode) return;
		else {
			if (persist) this.#auto_mode = false; // keep theme even if os changes theme
			logger.debug("mode changed to " + mode);
			this.#activateTheme(mode == "dark" ? this.#default_dark_theme : this.#default_light_theme);
		}
	}

	/**
	 * Activate a new theme (must be registered with registerTheem)
	 */
	public setTheme(name: string, allowLazyLoad = false) {
		const theme = this.getTheme(name)
		if (!theme) {
			if (allowLazyLoad) {
				this.#waiting_theme = name;
				return;
			}
			else throw new Error(`Cannot set them "${name}", not registered`);
		}
		this.#activateTheme(theme);
	}

	#current_theme_css_text = ""

	getCurrentThemeCSS(){
		return this.#current_theme_css_text;
	}

	getThemesCSS(){
		return [...this.#themesCSS.values()].join("\n");
	}

	/**
	 * returns css text for a theme, using .theme-xx selector
	 * @param name theme name
	 * @param useRootSelector use :root selector instead of .theme-xx selector
	 * @returns 
	 */
	getThemeCSS(name: string, useRootSelector = false) {
		const css = this.#themesCSS.get(name);
		if (useRootSelector) return css?.replace('.theme-'+name, ':root') 
		else return css;
	}

	// update the current theme (changes immediately)
	#activateTheme(theme:Theme) {
		this.#current_theme = theme.name;
		logger.debug(`using theme "${theme.name}"`)

		setCookie(UIX_COOKIE.theme, theme.name);
		setCookie(UIX_COOKIE.colorMode, theme.mode);

		let text = ":root{";
		// iterate over all properties (also from inherited prototypes)
		// TODO only iterate over allowed properties?
		const added_properties = new Set();
		for (let o = theme.values; o && o != Object.prototype; o = Object.getPrototypeOf(o)) {
			for (const [key, value] of Object.entries(o)) {
				if (added_properties.has(key)) continue;
				added_properties.add(key);
				this.#values[key] = value;
				text += `--${key}: ${value};` // TODO escape?
			}
		}

		text += "}";
		this.#current_theme_css_text = text;

		this.updateCurrentThemeStyle()

		this.#current_mode = theme.mode; // only now trigger Theme.mode observers
		// css global color scheme
		if (client_type === "browser") {
			document.body.style.colorScheme = theme.mode;
			document.body.dataset.colorScheme = theme.mode;
		}

		// call them change listeners
		for (const observer of this.mode_change_observers) observer(theme.mode);
	}

	addGlobalThemeClass(theme: Theme) {
		let text = `.theme-${theme.name} {`;
		// iterate over all properties (also from inherited prototypes)
		// TODO only iterate over allowed properties?
		const added_properties = new Set();
		for (let o = theme.values; o && o != Object.prototype; o = Object.getPrototypeOf(o)) {
			for (const [key, value] of Object.entries(o)) {
				if (added_properties.has(key)) continue;
				added_properties.add(key);
				text += `--${key}: ${value};` // TODO escape?				
			}
		}

		// update default current text colors
		text += `--current_text_color: var(--text);`
		text += `--current_text_color_highlight: var(--text_highlight);`
		text += `color: var(--current_text_color);`
		// set color scheme
		text += `color-scheme: ${theme.mode}`

		text += "}";

		this.#themesCSS.set(theme.name, text);

		this.updateGlobalThemeStyle(theme.name)
	}

	private updateCurrentThemeStyle(){
		this.#current_theme_style_sheet.replaceSync?.(this.#current_theme_css_text);

		// add to document
		if (!this.#current_theme_style_sheet_added) {
			if (client_type === "browser") document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.#current_theme_style_sheet, this.#global_style_sheet];
			this.#current_theme_style_sheet_added = true;
		}
	}

	private updateGlobalThemeStyle(name:string){
		// set all current style classes global style
		let global_style = "";
		for (const style of this.#themesCSS.values()) {
			global_style += style + '\n';
		}
		this.#global_style_sheet.replaceSync?.(global_style);

		// add to document
		if (!this.#global_style_sheet_added) {
			if (client_type === "browser") document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.#current_theme_style_sheet, this.#global_style_sheet];
			this.#global_style_sheet_added = true;
		}
	}

	addThemeFromParsedStylesheet(sheet:CSSStyleSheet) {
		for (const rule of <CSSStyleRule[]><any>sheet.cssRules) {
			const name = rule.selectorText.replace(".theme-","")
			const values:Record<string,string> = {};
			const mode:"dark"|"light" = rule.style.getPropertyValue("color-scheme") ?? "light";

			for (let i = 0; i < rule.style.length; i++) {
				const prop = rule.style.item(i);
				if (!prop.startsWith("--")) continue;
				if (prop === "--current_text_color" || prop === "--current_text_color_highlight") continue;
				const key = prop.replace("--","");
				const val = rule.style.getPropertyValue(prop);
				values[key] = val;
			}

			this.registerTheme({
				name,
				mode,
				values
			});
		}
	}

	// create new theme based on another theme
	extend(theme:Theme, override:Partial<Theme> & {name: string}) {
		if (!("mode" in override)) override.mode = theme.mode;
		if (!("name" in override)) throw new Error("Name required");

		const overrideValues = override.values ?? {};
		override.values = Object.create(theme.values);
		for (const [key, value] of Object.entries(overrideValues)) {
			override.values![key] = value;
		}
		return override;
	}

	private mode_change_observers = new Set<Function>();
	onModeChange(observer:(theme:"dark"|"light")=>void) {
		this.mode_change_observers.add(observer);
	}

}

let themeManager:ThemeManager|undefined;

export function getThemeManager() {
	if (!themeManager) themeManager = new ThemeManager();
	return themeManager;
}