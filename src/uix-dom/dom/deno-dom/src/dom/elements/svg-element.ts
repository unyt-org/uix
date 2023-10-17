import { CTOR_KEY } from "../../constructor-lock.ts";
import { DOMStringMap } from "../dom-string-map.ts";
import { Element } from "../element.ts";
import { Node } from "../node.ts";
import { SVGTag } from "../types/tags.ts";

export class SVGElement extends Element {
	
	constructor(
		tagName: SVGTag,
		parentNode: Node | null,
		attributes: [string, string][],
		key: typeof CTOR_KEY
	) {
		super(
			tagName,
			"http://www.w3.org/2000/svg",
			parentNode,
			attributes,
			key,
		);
	}

	dataset = DOMStringMap.create(this)

}