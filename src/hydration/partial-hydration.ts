import type { Element, Node } from "../uix-dom/dom/mod.ts";

@sync("uix:PartialHydration") export class PartialHydration {
	@property nodes!: Node[]

	construct(root: Element) {
		// this.nodes = getLiveNodes(root);
	} 

}