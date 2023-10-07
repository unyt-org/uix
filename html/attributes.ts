
/**
 * HTML Element attribute definitions
 * https://www.w3schools.com/tags/
 */

import type { Datex } from "unyt_core/datex.ts";
import type { primitive } from "unyt_core/types/abstract_types.ts"
import { UIX } from "uix/uix.ts";


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
	"role", "name", "slot", "bgcolor",
	// uix specific
	"uix-module", "datex-pointer", "shadow-root", "light-root"
] as const;

// TODO: replace with uix:, datex:
// custom attribute values for default attributes (default: string)
type customDefaultAttributeValues = {
	"uix-module": string|URL|null,
	"shadow-root": boolean|'open'|'closed',
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
const src = ["src", "src:route"] as const;
type src = {
	src: string|URL
	"src:route": string
}

// href
const href = ["href", "href:route"] as const;
type href = {
	href: string|URL
	"href:route": string
}

// alt
const alt = "alt" as const;


/** list of all allowed attributes for HTML elements */
export const htmlElementAttributes = {

	// TODO replace valueOut, ... with value:out

	a: [...href, "target"],
	link: [...href, "rel"],

	script: [...src, "type"],

	progress: ["value", "max", "min"],
	input: [alt, ...src, alt, ...widthAndHeight, "min", "minlength", "accept", "autocomplete", "autofocus", "checked", "dirname", "disabled", "form", "formaction", "formenctype", "formmethod", "formnovalidate", "formtarget", "list", "max", "maxlength", "multiple", "name", "pattern", "placeholder", "readonly", "required", "size", "step", "type", "value", "valueOut", "valueInitial"],
	button: ["type", "disabled"],
	form: ["method", "enctype", "action"],
	img: [alt, ...src, ...widthAndHeight, "crossorigin", "ismap", "loading", "longdesc", "referrerpolicy", "sizes", "srcset", "usemap"],
	template: ["shadowrootmode"],
	iframe: [...src, "allowtransparency"],
	details: ["open"],
	source: [...src, "type"],
	label: ["for"],
	video: [...src, ...widthAndHeight, "autoplay", "controls", "loop", "muted", "poster", "preload", "playsinline"],
	textarea: ["placeholder"],
	option: ["value", "selected"],
	select: [],
	td: ["height", "colspan", "width"],
	table: ["border", "cellpadding", "cellspacing", "align", "width"]
} as const satisfies {[key in keyof HTMLElementTagNameMap]?: readonly string[]};


/** custom values for specific element attributes (default: string) */
export type htmlElementAttributeValues = {
	a: href,

	link: href,

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
		min: htmlNumber|string
		minlength: htmlNumber
		multiple: boolean
		readonly: boolean
		required: boolean
		size: htmlNumber,
		step: htmlNumber,
		type: "button"|"checkbox"|"color"|"date"|"datetime-local"|"email"|"file"|"hidden"|"image"|"month"|"number"|"password"|"radio"|"range"|"reset"|"search"|"submit"|"tel"|"text"|"time"|"url"|"week",

		value: primitive,
		valueOut: Datex.Pointer,
	},

	progress: {
		value: string | number,
		max: string | number,
		min: string | number
	},

	button: {
		type: "button"|"submit"|"reset",
		disabled: boolean
	},

	form: {
		method: "get"|"post",
		enctype: "application/x-www-form-urlencoded"|"multipart/form-data"|"text/plain"
		action: string|UIX.Entrypoint
	},

	img: widthAndHeight & src &  {
		crossorigin: "anonymous"|"use-credentials"
		ismap: boolean,
		loading: "eager"|"lazy",
		referrerpolicy: "no-referrer"|"no-referrer-when-downgrade"|"origin"|"origin-when-cross-origin"|"unsafe-url",
		usemap: `#${string}`
	},
	template: {
		shadowrootmode: 'open'|'closed'
	},

	iframe: src & {
		allowtransparency: boolean | "true" | "false"
	},

	source: src,

	video: widthAndHeight & (src | {src: MediaStream}) & {
		autoplay: boolean,
		controls: boolean,
		loop: boolean,
		muted: boolean,
		poster: string|URL,
		preload: "auto"|"metadata"|"none"
	},
	textarea: widthAndHeight & {
		placeholder: string
	},

	option: {
		selected: boolean
	}
}



// width, height
const cXY = ["cx", "cy"] as const;
type cXY = {
	cx: htmlPixels,
	cy: htmlPixels
}

export const svgTags = new Set(["animate", "animateMotion", "animateTransform", "circle", "clipPath", "defs", "desc", "ellipse", "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDisplacementMap", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence", "filter", "foreignObject", "g", "image", "line", "linearGradient", "marker", "mask", "metadata", "mpath", "path", "pattern", "polygon", "polyline", "radialGradient", "rect", "set", "stop",  "svg", "switch", "symbol", "text", "textPath","tspan", "use", "view"] satisfies (keyof SVGElementTagNameMap)[])

// TODO: name collisions: "a", "script", "style",  "title", 

/** list of all allowed attributes for HTML elements */
export const svgElementAttributes = {
	circle: [...cXY, "fill", "r"],
	svg: [...widthAndHeight, "xmlns", "viewBox", "preserveAspectRatio", "fill"],
	path: ["stroke", "stroke-width", "fill", "d", "fill-rule"]
} as const satisfies {[key in keyof SVGElementTagNameMap]?: readonly string[]};


/** custom values for specific element attributes (default: string) */
export type svgElementAttributeValues = {
	circle: cXY & {
		r: htmlPixels
	}
}


export const mathMLTags = new Set(["annotation","annotation-xml","maction","math","merror","mfrac","mi","mmultiscripts","mn","mo","mover","mpadded","mphantom","mprescripts","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msubsup","msup","mtable","mtd","mtext","mtr","munder","munderover","semantics"] satisfies (keyof MathMLElementTagNameMap)[])
