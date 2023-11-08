import { Theme } from "../base/theme-manager.ts";
import { uixDarkPlain } from "./uix-dark-plain.ts";

export const uixDark = {
	...uixDarkPlain,
	name: "uix-dark",
	stylesheets: [new URL("./css/uix.css",import.meta.url), "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"]
}  satisfies Theme;