import { Pointer } from "datex-core-legacy/runtime/pointers.ts";
import { Element } from "../uix-dom/dom/mod.ts";

class HydrationCache {

	get(ptrId: string) {
		const ptr = this.#ptrs.get(ptrId);
		return ptr;
	}

	#ptrs = new Map<string, Pointer>

	add(rootElement: Element) {
		const ptr = Pointer.getByValue(rootElement);
		if (ptr) this.#ptrs.set(ptr.id, ptr);
	}

}


export const hydrationCache = new HydrationCache()