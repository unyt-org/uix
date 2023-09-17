// @ts-ignore sfgafari workaround
export const COMPONENT_CONTEXT: unique symbol = globalThis.uix_COMPONENT_CONTEXT ??= Symbol("COMPONENT_CONTEXT");
// @ts-ignore sfgafari workaround
export const STANDALONE: unique symbol = globalThis.uix_STANDALONE ??= Symbol("STANDALONE");
// @ts-ignore sfgafari workaround
export const EXTERNAL_SCOPE_VARIABLES: unique symbol = Symbol("STANDALONE_CONTEXT");

// @ts-ignore TODO: reenable
const PROPS_MAP = globalThis.uix_PROPS_MAP ??= Symbol("PROPS_MAP");


function getElementWithId(parent:Element|ShadowRoot, id:string) {
	return parent.querySelector("#"+id) ?? 
		parent.querySelector(`[data-placeholder-id="${id}"]`) ??
		(parent as Element).shadowRoot?.querySelector("#"+id) ?? 
		(parent as Element).shadowRoot?.querySelector(`[data-placeholder-id="${id}"]`);
}

/**
 * 
 * @param element 
 * @param id_props 
 * @param content_props 
 * @param layout_props 
 * @param child_props 
 * @param allow_existing 
 * @param load_from_props 
 */
export function bindContentProperties(element: HTMLElement & {[key:string|symbol]:any}, id_props?:Record<string,string>, content_props?:Record<string,string>, layout_props?:Record<string,string>, child_props?:Record<string,string>, allow_existing = false, load_from_props = true){
	
	// @UIX.id props
	if (!element[PROPS_MAP]) element[PROPS_MAP] = new Map<string,any>();
	const props_map = element[PROPS_MAP];
	
	if (id_props) {
		for (const [prop,id] of Object.entries(id_props)) {
			if (content_props?.[prop] || layout_props?.[prop] || child_props?.[prop]) continue; // is content, ignore

			const prev = element[prop];

			Object.defineProperty(element, prop, {
				get() {
					return props_map.get(prop) ?? getElementWithId(element, id);
				},
				set(el) {
					if (el instanceof Element) el.setAttribute("id", id); // auto set id
					if (el) props_map.set(prop, el)
				},
				configurable: true,
			})

			if (prev != undefined) element[prop] = prev; // trigger setter
		}
	}

	// @UIX.content props
	if (content_props) {
		const container = ()=>element.shadowRoot?.querySelector("#content")??element
		for (const [prop,id] of Object.entries(content_props)) {
			if (!allow_existing && element[prop] instanceof Element && element.shadowRoot?.contains(element[prop])) throw new Error("property '" + prop +"' cannot be used as an @content property - already part of the component")
			bindContent(element, container, prop, id, load_from_props)
		}
	}

	// @UIX.layout props
	if (layout_props) {
		const container = ()=>element.shadowRoot?.querySelector("#content_container")??element.shadowRoot??element
		for (const [prop,id] of Object.entries(layout_props)) bindContent(element, container, prop, id, load_from_props)
	}

	// @UIX.child props
	if (child_props) {
		const container = ()=>element;
		for (const [prop,id] of Object.entries(child_props)) bindContent(element, container, prop, id, load_from_props)
	}

}


function bindContent(element:HTMLElement & {[key:string|symbol]:any}, container:()=>Element|ShadowRoot|null|undefined, prop:string, id:string, load_from_prop = true) {
	

	if (!element[PROPS_MAP]) element[PROPS_MAP] = new Map<string,any>();
	const props_map = element[PROPS_MAP]!;

	const prev = element[prop];

	const property_descriptor = Object.getOwnPropertyDescriptor(element, prop) 
					
	Object.defineProperty(element, prop, {
		configurable: true,
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
			if (!(el instanceof Element)) {
				const inner = el;
				el = document.createElement("span");
				el.append(inner);
			}

			// set outer element as [COMPONENT_CONTEXT]
			el[COMPONENT_CONTEXT] = element;
			// set [STANDALONE]
			if (element.isStandaloneProperty?.(prop)) el[STANDALONE]  = true;

			// add to content if it exists
			const content = container();
			if (content) {
				const previous = getElementWithId(content, id);
				if (previous == el) {/* ignore */}
				else if (previous) content.replaceChild(el, previous);
				else {
					const contentSlot = (content instanceof ShadowRoot || content.id=="content_container") && content.querySelector("#content");
					// insert before #content slot in #content_container
					if (contentSlot) content.insertBefore(el, contentSlot);
					else content.append(el);
				}
			}

			if (!isPlaceholder) {
				el.setAttribute("id", id); // auto set id
				if (property_descriptor?.set) property_descriptor.set.call(element, el);
				props_map.set(prop, el)
			}
			else el.setAttribute("data-placeholder-id", id);
		}
	})

	if (load_from_prop) element[prop] = prev; // trigger setter
}