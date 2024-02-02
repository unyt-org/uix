import { app } from "../app/app.ts";
import { querySelector, querySelectorAll } from "../uix-dom/dom/shadow_dom_selector.ts";
import { domUtils } from "../app/dom-context.ts";

export async function hydrate() {
	const nodes = querySelectorAll("[uix-dry]");
	const ptrs = nodes
		.map(node => [node.getAttribute("uix-ptr"), node])
		.filter(([id, node]) => {
			if (!id) {
				console.warn("hydrate: missing uix-ptr attribute in node", node);
				return false;
			}
			else return true;
		})
		.map(([id]) => "$" + id);
	const resolvedPtrs = await datex<any[]>(`${app.backend} :: [${ptrs.join(",")}]`);

	for (const [index, resolved] of Object.entries(resolvedPtrs)) {
		// replace non-node pointer - this currently only happens with uix-placeholder elements
		if (!(resolved instanceof Node)) {
			const node = querySelector(`[uix-ptr="${ptrs[Number(index)].substring(1)}"]`)
			if (!node) console.error("hydrate: node not found for uix-ptr " + ptrs[Number(index)])
			else domUtils.replaceWith(node, resolved)
		}
	}

}