import { DX_PTR } from "datex-core-legacy/runtime/constants.ts";
import { Datex } from "datex-core-legacy/mod.ts";

const elementObservers = new WeakMap<Element, {cancel:()=>void, eventTarget:EventTarget}>()

export function observeElementforSSE(element: Element) {

	if (!Datex.ReactiveValue.isRef(element)) throw new Error("Element is not a pointer")

	// return existing
	if (elementObservers.has(element)) {
		// console.log("existing observer", element.tagName)
		return elementObservers.get(element)!;
	}

	// console.log("observe",element.tagName)

	const eventTarget = new EventTarget()

	// Datex.ReactiveValue.observe(element, (...args)=>{
	// 	console.log(">>OB", ...args);
	// }, undefined, undefined, {
	// 	recursive: true
	// })


	// // Options for the observer (which mutations to observe)
	// const config = { attributes: true, childList: true, subtree: false };
	// Callback function to execute when mutations are observed
	// const callback = (mutationList:MutationRecord[], observer:MutationObserver) => {
	// 	for (const mutation of mutationList) {
	// 		console.log("mut", mutation.type, mutation.oldValue)
	// 		if (mutation.type === "childList") {
	// 			console.log("A child node has been added or removed.");
	// 		} else if (mutation.type === "attributes") {
	// 			// special property
	// 			if (mutation.attributeName == "value" || mutation.attributeName == "checked") {
	// 				const val = (mutation.target as Element)[mutation.attributeName];
	// 				eventTarget.dispatchEvent(new CustomEvent("update", {detail:`PROP ${mutation.target[DX_PTR].id} ${mutation.attributeName} ${JSON.stringify(val)??"null"}`}))
	// 			}
	// 			// normal attribute
	// 			else {
	// 				const val = (mutation.target as Element).getAttribute(mutation.attributeName!);
	// 				eventTarget.dispatchEvent(new CustomEvent("update", {detail:`ATTR ${mutation.target[DX_PTR].id} ${mutation.attributeName} ${JSON.stringify(val)??"null"}`}))
	// 			}
	// 		}
	// 	}
	// };

	// // Create an observer instance linked to the callback function
	// const observer = new MutationObserver(callback);
	// observer.observe(element, config);

	const data = {
		eventTarget,
		cancel: () => observer.disconnect()
	};

	elementObservers.set(element, data)

	return data;
}