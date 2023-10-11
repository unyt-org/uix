import { Datex } from "unyt_core/datex.ts";
import type { Element, Node } from "uix/uix-dom/dom/mod.ts";
import { logger } from "unyt_core/utils/global_values.ts";

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
		for (const [_attr, val] of Object.entries(serialized.attr ?? {})) {
			if (!includeEventListeners && typeof val == "function") continue; // ignore event listeners
			const ptr = Datex.Pointer.getByValue(val);
			if (ptr) {
				isLive = true;
				break;
			}
		}
	}

	if (isLive) _list.push(treeRoot);
	return _list;
}