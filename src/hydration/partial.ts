import { Datex } from "datex-core-legacy";
import type { Element, Node } from "../uix-dom/dom/mod.ts";
import { Component } from "../components/Component.ts";
import { DOMUtils } from "../uix-dom/datex-bindings/dom-utils.ts";

/**
 * Returns a list of all nodes in a DOM tree that have live pointer binding
 * @param treeRoot dom tree root element
 * @param includeEventListeners if true, elements with active event listeners are regarded as live elements
 */
export function getLiveNodes(treeRoot: Element, includeEventListeners = true, _list:Node[] = []) {
	const serialized = Datex.Runtime.serializeValue(treeRoot) as {
		content: any[],
		attr: Record<string, any>
	};

	let isLive = false;

	// if (treeRoot instanceof Component) isLive = true;

	// iterate children
	for (const val of (serialized.content instanceof Array ? serialized.content : [serialized.content]) ?? []) {
		if (val instanceof Element) getLiveNodes(val, includeEventListeners, _list);
		else {
			const ptr = Datex.Pointer.pointerifyValue(val);
			if (ptr instanceof Datex.Pointer) {
				isLive = true;
			}
		}
	}
	
	if (!isLive) {
		if (treeRoot[DOMUtils.ATTR_BINDINGS]?.size) isLive = true
	}

	if (isLive) _list.push(treeRoot);
	return _list;
}