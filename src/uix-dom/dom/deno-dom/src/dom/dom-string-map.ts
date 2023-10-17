import { Element } from "./element.ts";

export class DOMStringMap {
	private constructor() {}

	static create(element: Element) {
		const domStringMap = new DOMStringMap();
		return new Proxy(domStringMap, {
			get(target,p,receiver) {
			  if (typeof p == "string") return element.getAttribute(`data-`+p)
			  else return (target as any)[p]
			},
			set(target,p,newValue,receiver) {
				if (typeof p == "string") element.setAttribute(`data-`+p, newValue)
				else (target as any)[p] = newValue
				return true;
			},
			deleteProperty(target,p) {
				if (typeof p == "string") element.removeAttribute(`data-`+p)
				else delete (target as any)[p];
				return true;
			},
		})
	}
}