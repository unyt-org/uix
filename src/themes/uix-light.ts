import { Theme } from "../base/theme-manager.ts";
import { uixLightPlain } from "./uix-light-plain.ts";

export const uixLight = {
	...uixLightPlain,
	name: "uix-light",
	stylesheets: [new URL("./css/uix.css",import.meta.url), "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"]
} satisfies Theme;