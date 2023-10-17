import { CTOR_KEY } from "../../constructor-lock.ts";
import { Element } from "../element.ts";
import { Node } from "../node.ts";
import { MathMLTag } from "../types/tags.ts";

export class MathMLElement extends Element {
	constructor(
		tagName: MathMLTag,
		parentNode: Node | null,
		attributes: [string, string][],
		key: typeof CTOR_KEY
	) {
		super(
			tagName,
			"http://www.w3.org/1998/Math/MathML",
			parentNode,
			attributes,
			key,
		);
	}
}