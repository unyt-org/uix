/**
 * EXPERIMENTAL
 */

export function bindDatex(element:Node) {
	console.log("bind datex ", element);

	const handler: MutationCallback = (mutations: MutationRecord[], observer: MutationObserver) => {
		console.log("mut", mutations)
	}
	`<html:div> (childs:[])`

	new MutationObserver(handler).observe(element, {attributes: true, childList: true})

	return element;
}


globalThis.bindDatex = bindDatex;