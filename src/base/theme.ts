export interface Theme {
	name: string,
	mode: "light" | "dark",
	values: Record<string, string>
}

export const defaultThemes: Record<string, Theme> = {
	light: {
		name: "uix-light",
		mode: "light",
		values: {
			text: "#333333",
			text_light: "#333333aa",
			text_highlight: "#171616",
	
			bg_default: "#f5f5f5",
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
	},

	dark: {
		name: "uix-dark",
		mode: "dark",
		values: {
			text: "#ababab",
			text_light: "#ababab80",
			text_highlight: "#efefef",
	
			bg_default: "#1c1c1f", // #1a1e2a94
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
	}
}