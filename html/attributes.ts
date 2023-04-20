
/**
 * HTML Element attribute definitions
 * https://www.w3schools.com/tags/
 */


// general html specific types

type numberString = `${number}`
type integerString = `${bigint}`
type htmlNumber = numberString|number|bigint
type htmlPixels = integerString|number|bigint
type htmlColor = ""


// list of all event handler content attributes
export const elementEventHandlerAttributes = [
	"onabort", "onblur", "oncanplay", "oncanplaythrough", "onchange", "onclick", "oncontextmenu", "oncuechange", "ondblclick", "ondrag", "ondragend", "ondragenter", "ondragleave", "ondragover", "ondragstart", "ondrop", "ondurationchange", "onemptied", "onended", "onerror", "onfocus", "oninput", "oninvalid", "onkeydown", "onkeypress", "onkeyup", "onload", "onloadeddata", "onloadedmetadata", "onloadstart", "onmousedown", "onmousemove", "onmouseout", "onmouseover", "onmouseup", "onmousewheel", "onpause", "onplay", "onplaying", "onprogress", "onratechange", "onreadystatechange", "onreset", "onscroll", "onseeked", "onseeking", "onselect", "onshow", "onstalled", "onsubmit", "onsuspend", "ontimeupdate", "onvolumechange", "onwaiting"
] as const;

// list of all default element attributes
export const defaultElementAttributes = [
	"accesskey", "class", "contenteditable", "contextmenu", "dir", "draggable", "dropzone", "hidden", "id", "lang", "spellcheck", "style", "tabindex", "title",
	// uix specific
	"uix-module", "datex-pointer"
] as const;

// custom attribute values for default attributes (default: string)
type customDefaultAttributeValues = {
	"uix-module": string|URL,
	"datex-pointer": boolean
}

export type validHTMLElementAttrs = {
	[key in typeof defaultElementAttributes[number]]: (key extends keyof customDefaultAttributeValues ? customDefaultAttributeValues[key] : string)
} & {
	[key in typeof elementEventHandlerAttributes[number]]: key extends keyof GlobalEventHandlers ? GlobalEventHandlers[key] : never
}

export type validHTMLElementSpecificAttrs<TAG extends string> = TAG extends keyof typeof htmlElementAttributes ? {
	[key in (typeof htmlElementAttributes)[TAG][number]]: TAG extends keyof htmlElementAttributeValues ? (key extends keyof htmlElementAttributeValues[TAG] ? htmlElementAttributeValues[TAG][key] : string) : string
} : Record<string, unknown>;

export type validSVGElementSpecificAttrs<TAG extends string> = TAG extends keyof typeof svgElementAttributes ? {
	[key in (typeof svgElementAttributes)[TAG][number]]: TAG extends keyof svgElementAttributeValues ? (key extends keyof svgElementAttributeValues[TAG] ? svgElementAttributeValues[TAG][key] : string) : string
} : Record<string, unknown>;



/** attribute definitions used by multiple elements */ 

// width, height
const widthAndHeight = ["width", "height"] as const;
type widthAndHeight = {
	width: htmlPixels,
	height: htmlPixels
}

// src
const src = "src" as const;
type src = {
	src: string|URL
}

// alt
const alt = "alt" as const;




/** list of all allowed attributes for HTML elements */
export const htmlElementAttributes = {

	a: ["href"],
	input: [alt, src, alt, ...widthAndHeight, "accept", "autocomplete", "autofocus", "checked", "dirname", "disabled", "form", "formaction", "formenctype", "formmethod", "formnovalidate", "formtarget", "list", "max", "maxlength", "multiple", "name", "pattern", "placeholder", "readonly", "required", "size", "step", "type", "value"],
	img: [alt, src, ...widthAndHeight, "crossorigin", "ismap", "loading", "longdesc", "referrerpolicy", "sizes", "srcset", "usemap"]

} as const satisfies {[key in keyof HTMLElementTagNameMap]?: readonly string[]};


/** custom values for specific element attributes (default: string) */
export type htmlElementAttributeValues = {
	a: {
		href: string|URL
	},

	input: widthAndHeight & src & {
		autocomplete: "on"|"off"
		autofocus: boolean
		checked: boolean 
		dirname: `${string}.dir`
		disabled: boolean
		formenctype: "application/x-www-form-urlencoded"|"multipart/form-data"|"text/plain"
		formmethod: "get"|"post"
		formnovalidate: boolean
		max: htmlNumber|string
		maxlength: htmlNumber
		multiple: boolean
		readonly: boolean
		required: boolean
		size: htmlNumber,
		step: htmlNumber,
		type: "button"|"checkbox"|"color"|"date"|"datetime-local"|"email"|"file"|"hidden"|"image"|"month"|"number"|"password"|"radio"|"range"|"reset"|"search"|"submit"|"tel"|"text"|"time"|"url"|"week"
	}
	img: widthAndHeight & src &  {
		crossorigin: "anonymous"|"use-credentials"
		ismap: boolean,
		loading: "eager"|"lazy",
		referrerpolicy: "no-referrer"|"no-referrer-when-downgrade"|"origin"|"origin-when-cross-origin"|"unsafe-url",
		usemap: `#${string}`
	}
}



// width, height
const cXY = ["cx", "cy"] as const;
type cXY = {
	cx: htmlPixels,
	cy: htmlPixels
}

/** list of all allowed attributes for HTML elements */
export const svgElementAttributes = {
	circle: [...cXY, "fill", "r"],
	svg: [...widthAndHeight, "xmlns", "viewBox"]
} as const satisfies {[key in keyof SVGElementTagNameMap]?: readonly string[]};


/** custom values for specific element attributes (default: string) */
export type svgElementAttributeValues = {
	circle: cXY & {
		r: htmlPixels
	}
}