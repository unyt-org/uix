import { Theme } from "../base/theme-manager.ts";

export const uixDarkPlain = {
	name: "uix-dark-plain",
	mode: "dark",
	values: {
		'sans-font': '-apple-system, BlinkMacSystemFont, "Avenir Next", Avenir, "Nimbus Sans L", Roboto, "Noto Sans", "Segoe UI", Arial, Helvetica, "Helvetica Neue", sans-serif',
		'mono-font': 'Consolas, Menlo, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
		'standard-border-radius': '5px',
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
} satisfies Theme;