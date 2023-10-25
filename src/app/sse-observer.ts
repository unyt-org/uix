const elementObservers = new WeakMap<Element, {disconnect:()=>void, eventStream:ReadableStream}>()

export function observeElementforSSE(element: Element) {


	// return existing
	if (elementObservers.has(element)) {
		console.log("existing observer", element.tagName)
		return elementObservers.get(element)!;
	}

	console.log("observe",element.tagName, MutationObserver)

	// Options for the observer (which mutations to observe)
	const config = { attributes: true, childList: true, subtree: false };

	const eventStream = new ReadableStream()

	// Callback function to execute when mutations are observed
	const callback = (mutationList, observer) => {
		for (const mutation of mutationList) {
			if (mutation.type === "childList") {
				console.log("A child node has been added or removed.");
			} else if (mutation.type === "attributes") {
				console.log(`The ${mutation.attributeName} attribute was modified.`);
			}
		}
	};

	// Create an observer instance linked to the callback function
	const observer = new MutationObserver(callback);
	observer.observe(element, config);

	const data = {
		eventStream,
		disconnect: () => observer.disconnect()
	};

	elementObservers.set(element, data)

	return data;
}