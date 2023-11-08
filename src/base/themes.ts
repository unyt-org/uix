import { client_type } from "datex-core-legacy/utils/constants.ts";
import type { Theme } from "./theme-manager.ts";

const commonValues = {
	'sans-font': '-apple-system, BlinkMacSystemFont, "Avenir Next", Avenir, "Nimbus Sans L", Roboto, "Noto Sans", "Segoe UI", Arial, Helvetica, "Helvetica Neue", sans-serif',
	'mono-font': 'Consolas, Menlo, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
	'standard-border-radius': '5px',
}

const lightPlain = {
	name: "uix-light-plain",
	mode: "light",
	values: {
		...commonValues,
		'text': "#212121",
		'text-light': "#585858",
		'text-highlight': "#111111",
		'bg': '#fff',
		'bg-content': '#f3f3f3',
		'accent-bg': '#f5f7ff',
		'accent': '#2a8ed4',
		'code': '#d81b60',
		'border': '#898EA4',
		'marked': '#ffdd33',
		'preformatted': '#444',
		'disabled': '#efefef',
		'purple': '#c470de',
		'green': '#1eda6d',
		'red': '#ea2b51',
		'dark-red': '#c53434',
		'blue': '#0669c1',
		'light-blue': '#3097db',
		'orange': '#ea5e2b',
		'yellow': '#ebb626'
	}
} as const;

const darkPlain = {
	name: "uix-dark-plain",
	mode: "dark",
	values: {
		...commonValues,
		'text': "#dcdcdc",
		'text-light': "#ababab",
		'text-highlight': "#ffffff",
		'bg': '#212121',
		'bg-content': '#292929',
		'accent-bg': '#2b2b2b',
		'accent': '#4FA9E8',
		'code': '#f06292',
		'border': '#898EA4',
		'marked': '#ffdd33',
		'preformatted': '#ccc',
		'disabled': '#111',
		'purple': '#c470de',
		'green': '#1eda6d',
		'red': '#ea2b51',
		'dark-red': '#c53434',
		'blue': '#0669c1',
		'light-blue': '#4FA9E8',
		'orange': '#ea5e2b',
		'yellow': '#ebb626'
	}
} as const;

const listeners = {
	// TODO:
	// async onActivate() {
	// 	if (client_type == "browser") {
	// 		const {enableOverlayScrollbarsGlobal} = await import("../utils/overlay-scrollbars.ts")
	// 		enableOverlayScrollbarsGlobal()
	// 	}
		
	// },
	// async onDeactivate() {
	// 	if (client_type == "browser") {
	// 		const {disableOverlayScrollbarsGlobal} = await import("../utils/overlay-scrollbars.ts")
	// 		disableOverlayScrollbarsGlobal()
	// 	}
	// }
} as const;

export const defaultThemes = {
	lightPlain,

	darkPlain,

	light: {
		...lightPlain,
		name: "uix-light",
		stylesheets: [new URL("./themes/uix.css",import.meta.url), "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"],
		...listeners
	},

	dark: {
		...darkPlain,
		name: "uix-dark",
		stylesheets: [new URL("./themes/uix.css",import.meta.url), "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"],
		...listeners
	} 
} as const satisfies Record<string, Theme> 
