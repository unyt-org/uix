import { Theme } from "../base/theme-manager.ts";

export const uixLightPlain = {
	name: "uix-light-plain",
	mode: "light",
	values: {
		'sans-font': '-apple-system, BlinkMacSystemFont, "Avenir Next", Avenir, "Nimbus Sans L", Roboto, "Noto Sans", "Segoe UI", Arial, Helvetica, "Helvetica Neue", sans-serif',
		'mono-font': 'Consolas, Menlo, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
		'standard-border-radius': '5px',
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
} satisfies Theme;