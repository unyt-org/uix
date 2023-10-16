import { constructor } from "datex-core-legacy/js_adapter/legacy_decorators.ts";
import type { Element, Node } from "../uix-dom/dom/mod.ts";
import { getLiveNodes } from "./partial.ts";

@sync("uix:PartialHydration") export class PartialHydration {
	@property nodes!: Node[]

	constructor(root:Element){}
	@constructor construct(root: Element) {
		this.nodes = getLiveNodes(root);
	} 

}