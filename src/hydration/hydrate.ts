import { app } from "../app/app.ts";
import { querySelectorAll } from "../uix-dom/dom/shadow_dom_selector.ts";

export async function hydrate() {
	const nodes = querySelectorAll("[uix-dry]");
	const ptrs = nodes.map(n => "$" + n.getAttribute("uix-ptr"));
	await datex(`${app.backend} :: [${ptrs.join(",")}]`);
}