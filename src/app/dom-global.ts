import type * as api from "../uix-dom/dom/deno-dom/src/api.ts"

// declare domContext global
declare global {
	const document: api.Document

	const DocumentFragment: typeof api.DocumentFragment
	type DocumentFragment = api.DocumentFragment

	const Document: typeof api.Document
	type Document = api.Document
	
	const Element: typeof api.Element
	type Element = api.Element
	
	const HTMLElement: typeof api.HTMLElement
	type HTMLElement = api.HTMLElement

	const HTMLDivElement: typeof api.HTMLDivElement
	type HTMLDivElement = api.HTMLDivElement

	const HTMLImageElement: typeof api.HTMLImageElement
	type HTMLImageElement = api.HTMLImageElement

	const HTMLDialogElement: typeof api.HTMLDialogElement
	type HTMLDialogElement = api.HTMLDialogElement

	const HTMLInputElement: typeof api.HTMLInputElement
	type HTMLInputElement = api.HTMLInputElement

	const HTMLOptionElement: typeof api.HTMLOptionElement
	type HTMLOptionElement = api.HTMLOptionElement


}