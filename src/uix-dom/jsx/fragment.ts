import type { DOMContext } from "../dom/DOMContext.ts";
import type { DOMUtils } from "../datex-bindings/DOMUtils.ts";
import type { Element } from "../dom/mod.ts";

export function getFragment(context: DOMContext, domUtils?: DOMUtils) {
	return function Fragment({children}:{children:Element[]}) {
		const fragment = new context.DocumentFragment();
		if (domUtils) domUtils.append(fragment, children);
		else fragment.append(...children);

		// @ts-ignore remember uix children array TODO: remove DATEX reference
		if (Datex?.Pointer.isReference(children)) fragment._uix_children = children;
		return fragment;
	}
}