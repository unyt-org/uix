import { DX_PTR } from "datex-core-legacy/runtime/constants.ts";

const elementObservers = new WeakMap<Element, {cancel:()=>void, eventTarget:EventTarget}>()

export function observeElementforSSE(element: Element) {


	// return existing
	if (elementObservers.has(element)) {
		console.log("existing observer", element.tagName)
		return elementObservers.get(element)!;
	}

	console.log("observe",element.tagName, MutationObserver)

	// Options for the observer (which mutations to observe)
	const config = { attributes: true, childList: true, subtree: false };

	const eventTarget = new EventTarget()

	// Callback function to execute when mutations are observed
	const callback = (mutationList:MutationRecord[], observer:MutationObserver) => {
		for (const mutation of mutationList) {
			console.log("mut", mutation.type, mutation.oldValue)
			if (mutation.type === "childList") {
				console.log("A child node has been added or removed.");
			} else if (mutation.type === "attributes") {
				const val = (mutation.target as Element).getAttribute(mutation.attributeName!);
				// console.log(`The ${mutation.attributeName} attribute was modified.`, val);
				eventTarget.dispatchEvent(new CustomEvent("update", {detail:`ATTR ${mutation.target[DX_PTR].id} ${mutation.attributeName} ${val}`}))
			}
		}
	};

	// Create an observer instance linked to the callback function
	const observer = new MutationObserver(callback);
	observer.observe(element, config);

	const data = {
		eventTarget,
		cancel: () => observer.disconnect()
	};

	elementObservers.set(element, data)

	return data;
}