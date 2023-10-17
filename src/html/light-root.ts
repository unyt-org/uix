import { domContext } from "../app/dom-context.ts";

/**
 * Alternative to ShadowRoot, also works with slot elements.
 * Does not have a separate document and encapsulated styles
 */
export class LightRoot extends domContext.HTMLElement {
	
	connectedCallback() {
		const parent = this.parentElement!;
		// move all parent children to slots
		for (const node of [...parent.childNodes as unknown as Iterable<Node>]) {
			if (node === this) continue;
			this.getChildSlot(node)?.append(node);
		}

		// proxyify parent node dom modification methods
		parent.append = (...nodes) => {nodes.forEach(node => this.getChildSlot(node)?.append(node))}
		parent.appendChild = (node) => {this.getChildSlot(node)?.appendChild(node); return node;}
		parent.removeChild = (node) => {this.removeChild(node); return node;}

		// TODO: support more methods, children, create virtual dom to keep track of parent children?

	}

	#defaultSlot?: HTMLSlotElement|null = null

	getChildSlot(child: Node|string) {
		if (child instanceof domContext.Element && child.hasAttribute("slot")) {
			return this.querySelector(`slot[name="${child.getAttribute("slot")}"]`)
		}
		else {
			return this.#defaultSlot ?? (this.#defaultSlot = this.querySelector('slot:not([name]), slot[name=""]'))
		}
	}
	
	disconnectedCallback() {
		throw new Error("Cannot remove light root from parent element")
	}

}

domContext.customElements.define("light-root", LightRoot)