import { client_type } from "datex-core-legacy/utils/constants.ts";
import { UIX_COOKIE, getCookie, setCookie } from "../session/cookies.ts";
import type { CSSStyleSheet } from "../uix-dom/dom/deno-dom/src/css/CSSStylesheet.ts";
import { Logger } from "datex-core-legacy/utils/logger.ts";
import { getCallerDir } from "datex-core-legacy/utils/caller_metadata.ts";
import { Path } from "../utils/path.ts";
import { uixLight } from "../themes/uix-light.ts";
import { uixDark } from "../themes/uix-dark.ts";
import { uixLightPlain } from "../themes/uix-light-plain.ts";
import { uixDarkPlain } from "../themes/uix-dark-plain.ts";

const logger = new Logger("uix theme");

export interface Theme {
	name: string,
	mode?: "light" | "dark",
	values?: Record<string, string>,
	stylesheets?: Readonly<(URL|string)[]>,
	scripts?: Readonly<(URL|string)[]>,
	onActivate?: () => void|Promise<void>,
	onDeactivate?: () => void|Promise<void>
	onRegister?: () => void|Promise<void>
}

type themeName = "uix-dark" | "uix-dark-plain" | "uix-light" | "uix-light-plain" | (string&{});
type darkThemeName = "uix-dark" | "uix-dark-plain" | (string&{});
type lightThemeName = "uix-light" | "uix-light-plain" | (string&{});

class ThemeManager  {

	#loadedThemes = new Map<string, Theme>()

	#values:{[key:string]:string} = {}

	#auto_mode = true
	#current_mode?: "dark"|"light"
	#current_theme!: string
	#waiting_theme?: string;

	#default_light_theme:Theme = uixLight;
	#default_dark_theme:Theme = uixDark;

	readonly #current_theme_style_sheet = new CSSStyleSheet();
	#document_stylesheets_added = false;

	#themeCustomStylesheets = new Map<string, string[]>()

	#preferredModeIfThemeAvailable?: "dark"|"light"

	#global_style_sheet = new CSSStyleSheet();

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

	customStyleSheets = new Set<string>()


	constructor() {

		// load themes from embedded style
		for (const sheet of document.styleSheets??[]) {
			// themes
			if ((<HTMLStyleElement>sheet.ownerNode)?.classList?.contains("uix-themes")) {
				this.addThemeFromParsedStylesheet(sheet)
			}
		}
		
		// add default themes if not already loaded from html
		if (!this.getTheme(uixLightPlain.name, true)) this.registerTheme(uixLightPlain);
		if (!this.getTheme(uixDarkPlain.name, true)) this.registerTheme(uixDarkPlain);
		if (!this.getTheme(uixDark.name, true)) this.registerTheme(uixDark);
		if (!this.getTheme(uixLight.name, true)) this.registerTheme(uixLight);


		const initialMode = client_type == "browser" && getCookie(UIX_COOKIE.initialColorMode) as "dark"|"light";
		const currentModeCookie = client_type == "browser" && getCookie(UIX_COOKIE.colorMode) as "dark"|"light";
		const currentMode = currentModeCookie || (client_type == "browser" ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light") : "light");
		
		const currentDarkTheme = client_type == "browser" ? (getCookie(UIX_COOKIE.themeDark) ?? "uix-dark") : "uix-dark";
		const currentLightTheme = client_type == "browser" ? (getCookie(UIX_COOKIE.themeLight) ?? "uix-light") : "uix-light";

		// set current theme if not a parsed theme
		if (currentMode == "dark" && this.getTheme(currentDarkTheme, true)) {
			this.setTheme(currentDarkTheme, true);
		}
		else if (currentMode == "light" && this.getTheme(currentLightTheme, true)) {
			this.setTheme(currentLightTheme, true);
		}
		else {
			this.#current_mode = currentMode;
			this.#current_theme = currentDarkTheme;
		}

		// current server-guessed mode does not match client mode, remember preferred theme to enable if a frontend theme is loaded
		if (!currentModeCookie && this.getTheme(currentDarkTheme, true)?.mode != currentMode) {
			this.#preferredModeIfThemeAvailable = currentMode;
		}

		// watch system theme change
		if (client_type == "browser") {
			(window as any).matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
				if (!this.auto_mode) return;
				logger.debug("system color scheme change")
				if (event.matches) this.setMode("dark")
				else this.setMode("light");
				this.auto_mode = true;
			})
		}
	}

	public getTheme(name: string, ignoreParsed = false) {
		const theme = this.#loadedThemes.get(name)
		if (ignoreParsed && theme?.parsed) return;
		return theme;
	}

	/**
	 * Register a new theme
	 * @param theme 
	 * @param useAsDefault use as default theme for dark/light mode
	 */
	public registerTheme(theme: Theme) {
		if (theme.stylesheets) {
			const dir = getCallerDir();
			theme.stylesheets = theme.stylesheets.map(s => new Path(s, dir))
		}
		this.#loadedThemes.set(theme.name, theme);
		this.addGlobalThemeClass(theme);
		this.#themeCustomStylesheets.set(theme.name, [...this.#normalizeThemeStylesheets(theme)])

		if (theme.onRegister && client_type == "deno") theme.onRegister()
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
	 * Sets a new theme (must be registered with registerTheem)
	 */
	private setTheme(name: themeName, allowLazyLoad = false) {
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

	
	/**
	 * Activate multiple themes. All previously activated themes
	 * are disabled.
	 * 
	 * The current theme is automatically selected
	 * from the provided themes, depending on the current dark/light mode
	 * @param themes 
	 */
	public useThemes(...themes: (themeName|Theme)[]) {
		let hasDarkTheme = false;
		let hasLightTheme = false;
		for (const nameOrTheme of themes) {
			let name: string;
			if (typeof nameOrTheme == "object") {
				this.registerTheme(nameOrTheme);
				name = nameOrTheme.name;
			}
			else name = nameOrTheme;

			const theme = this.getTheme(name);
			if (!theme) logger.warn(`Theme ${name} is not a registered theme`);
			else {
				if (!hasDarkTheme && (!theme.mode || theme.mode == "dark")) {
					hasDarkTheme = true 
					this.setDefaultDarkTheme(theme);
				}
				if (!hasLightTheme && (!theme.mode || theme.mode == "light")) {
					hasLightTheme = true;
					this.setDefaultLightTheme(theme);
				}
			}
			
		}

		// no custom themes found, activate default themes
		if (!hasDarkTheme) this.setDefaultDarkTheme(uixDark)
		if (!hasLightTheme) this.setDefaultLightTheme(uixLight)
	}

	/**
	 * Activate a theme. All previously activated themes
	 * are disabled.
	 * @param themes 
	 */
	public useTheme(theme: themeName|Theme) {
		return this.useThemes(theme)
	}

	/**
	 * Sets a theme as the preferred dark theme
	 */
	private setDefaultDarkTheme(theme: Theme) {
		if (theme.mode && theme.mode !== "dark") throw new Error(`Theme "${theme.name} is not a dark mode theme"`)

		this.#default_dark_theme = theme;
		// theme matches current mode, immediately apply
		if (!theme.mode || theme.mode == this.#current_mode) this.#activateTheme(theme);
	}

	/**
	 * Sets a theme as the preferred light theme
	 */
	private setDefaultLightTheme(theme: Theme) {
		if (theme.mode && theme.mode !== "light") throw new Error(`Theme "${theme.name} is not a light mode theme"`)

		this.#default_light_theme = theme;
		// theme matches current mode, immediately apply
		if (!theme.mode || theme.mode == this.#current_mode) this.#activateTheme(theme);
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

	/**
	 * returns a list of stylesheets for a given theme
	 * @param name
	 */
	getThemeStylesheets(name: string) {
		return this.#themeCustomStylesheets.get(name);
	}

	// update the current theme (changes immediately)
	#activateTheme(theme:Theme) {

		if (this.#current_theme == theme.name) return;

		// deactivate previous theme
		const currentTheme = this.getTheme(this.#current_theme) 
		if (currentTheme?.onDeactivate) {
			try {
				currentTheme.onDeactivate()
			}
			catch (e) {
				console.error(e)
			}
		}

		this.#current_theme = theme.name;
		console.warn(theme.name)
		logger.debug(`using theme "${theme.name}"`)

		setCookie(UIX_COOKIE.themeDark, theme.name);
		if (theme.mode) setCookie(UIX_COOKIE.colorMode, theme.mode);

		let text = ":root{";
		// iterate over all properties (also from inherited prototypes)
		// TODO only iterate over allowed properties?
		const added_properties = new Set();
		for (let o = theme.values??{}; o && o != Object.prototype; o = Object.getPrototypeOf(o)) {
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

		console.log("active",theme)
		this.#current_mode = theme.mode ?? "light"; // only now trigger Theme.mode observers
		// css global color scheme
		if (client_type === "browser") {
			document.documentElement.style.colorScheme = theme.mode ?? "light";
			document.body.dataset.colorScheme = theme.mode ?? "light";
		}

		// stylesheets
		if (theme.stylesheets) {			
			this.#updateCustomStylesheets(this.#normalizeThemeStylesheets(theme))
		}
		else this.#clearCustomStyleSheets();

		if (theme.onActivate) {
			try {
				theme.onActivate()
			}
			catch (e) {
				console.error(e)
			}
		}

		// call them change listeners
		for (const observer of this.mode_change_observers) observer(theme.mode);
	}

	#normalizeThemeStylesheets(theme: Theme) {
		const customStylesheets = new Set<string>()
		for (const url of theme.stylesheets??[]) {
			customStylesheets.add(new URL(url).toString())
		}
		return customStylesheets;
	}

	#clearCustomStyleSheets(exclude?: Set<string>) {
		if (client_type == "browser") {
			for (const link of document.head.querySelectorAll('link.custom-theme')) {
				if (exclude?.has(link.href)) continue;
				link.remove();
			}
		}
		
		this.customStyleSheets.clear();
	}

	#updateCustomStylesheets(customStyleSheets: Set<string>) {
		if (client_type == "browser") {
			this.#clearCustomStyleSheets(customStyleSheets);
			for (const url of customStyleSheets) {
				if (document.head.querySelector('link.custom-theme[href="'+url+'"]')) continue;
				const stylesheet = document.createElement("link");
				stylesheet.classList.add("custom-theme");
				stylesheet.rel = "stylesheet"
				stylesheet.href = url.toString()
				document.head.append(stylesheet)
			}
		}
		this.customStyleSheets = customStyleSheets;
	}

	addGlobalThemeClass(theme: Theme) {
		let text = `.theme-${theme.name} {`;
		// iterate over all properties (also from inherited prototypes)
		// TODO only iterate over allowed properties?
		const added_properties = new Set();
		for (let o = theme.values??{}; o && o != Object.prototype; o = Object.getPrototypeOf(o)) {
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
		if (theme.mode) text += `color-scheme: ${theme.mode}`

		text += "}";

		this.#themesCSS.set(theme.name, text);

		this.updateGlobalThemeStyle(theme.name)
	}

	private updateCurrentThemeStyle(){
		this.#current_theme_style_sheet.replaceSync?.(this.#current_theme_css_text);

		// add to document
		if (!this.#document_stylesheets_added) {
			if (client_type === "browser") document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.#current_theme_style_sheet, this.#global_style_sheet];
			this.#document_stylesheets_added = true;
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
		if (!this.#document_stylesheets_added) {
			if (client_type === "browser") document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.#current_theme_style_sheet, this.#global_style_sheet];
			this.#document_stylesheets_added = true;
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
				values,
				parsed: true
			});
		}
	}

	// create new theme based on another theme
	extend(theme:Theme, override:Partial<Theme> & {name: string}): Theme {
		const dir = getCallerDir();
		if (!("mode" in override)) override.mode = theme.mode;
		if (!("name" in override)) throw new Error("Name required");

		const overrideValues = override.values ?? {};
		override.values = Object.create(theme.values);
		for (const [key, value] of Object.entries(overrideValues)) {
			override.values![key] = value;
		}
		override.stylesheets = [...(theme.stylesheets??[]), ...(override.stylesheets?.map(s => new Path(s, dir))??[])]
		
		return override as Theme;
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