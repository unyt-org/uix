import { HTMLUtils } from "../html/utils.ts";


// TODO: reenable
const PROPS_MAP = Symbol("PROPS_MAP");

function _get_PROPS_MAP() {
	// @ts-ignore
	if (!globalThis.uix_bound_PROPS_MAP) globalThis.uix_bound_PROPS_MAP = Symbol("PROPS_MAP");
	// @ts-ignore
	return globalThis.uix_bound_PROPS_MAP;
}

export function bindContentProperties(element: HTMLElement & {[key:string|symbol]:any}, id_props:Record<string,string>, content_props:Record<string,string>, allow_existing = false){

	// TODO: fix
	// SaFaRi: ReferenceError: Cannot access uninitialized variable??!?
	const PROPS_MAP = _get_PROPS_MAP()  


	// @UIX.id props
	if (!element[PROPS_MAP]) element[PROPS_MAP] = new Map<string,any>();
	const props_map = element[PROPS_MAP];
	
	if (id_props) {
		for (const [prop,id] of Object.entries(id_props)) {
			if (content_props[prop]) continue; // is content, ignore

			const prev = element[prop];

			Object.defineProperty(element, prop, {
				get() {
					return props_map.get(prop)
				},
				set(el) {
					if (el instanceof HTMLElement) el.setAttribute("id", id); // auto set id
					if (el) props_map.set(prop, el)
				}
			})

			if (prev != undefined) element[prop] = prev; // trigger setter
		}
	}

	// @UIX.content props
	if (content_props) {
		for (const [prop,id] of Object.entries(content_props)) {

			if (!allow_existing && element[prop] instanceof HTMLElement && element.shadowRoot?.contains(element[prop])) throw new Error("property '" + prop +"' cannot be used as an @content property - already part of the component")

			const prev = element[prop];

			const property_descriptor = Object.getOwnPropertyDescriptor(element, prop) 
						 
			Object.defineProperty(element, prop, {
				get: () => {
					if (property_descriptor?.get) return property_descriptor.get.call(element);
					return props_map.get(prop)
				},
				set: (el) => {
					// use placeholder if not set
					let isPlaceholder = false;
					if (!el) {
						el = document.createElement("div");
						isPlaceholder = true;
					}
					// encapsulate in HTMLElement
					if (!(el instanceof HTMLElement)) el = HTMLUtils.createHTMLElement('<span></span>', el);

					// add to content if it exists
					const content = element.shadowRoot?.querySelector("#content");
					if (content) {
						const previous = content.querySelector("#"+id) ?? content.querySelector(`[data-placeholder-id="${id}"]`);
						if (previous == el) {/* ignore */}
						else if (previous) content.replaceChild(el, previous);
						else content.append(el);
					}

					if (!isPlaceholder) {
						el.setAttribute("id", id); // auto set id
						if (property_descriptor?.set) property_descriptor.set.call(element, el);
						props_map.set(prop, el)
					}
					else el.setAttribute("data-placeholder-id", id);
				}
			})

			element[prop] = prev; // trigger setter
		}
	}

}