import { HTMLElement } from "./elements/html-element.ts";

type CustomElementOptions = {extends: string};

export class CustomElementRegistry<Tag extends string = string> {

	static #registries = new Set<CustomElementRegistry>()
	static getConstructor(name: string) {
		name = name.toUpperCase();
		for (const registry of this.#registries) {
			const constructor = registry.get(name);
			if (constructor) return constructor;
		}
	}
	static getTagName(constructor: typeof HTMLElement) {
		for (const registry of this.#registries) {
			const name = registry.getName(constructor);
			if (name) return name;
		}
	}

	constructor() {
		CustomElementRegistry.#registries.add(this)
	}

	#elements = new Map<Tag, {constructor: typeof HTMLElement, options?: CustomElementOptions}>

	define(name: Tag, constructor: typeof HTMLElement, options?: CustomElementOptions) {
		name = name.toUpperCase() as Tag;
		this.#elements.set(name, {constructor, options})
	}

	get(name: Tag) {
		name = name.toUpperCase() as Tag;
		return this.#elements.get(name)?.constructor;
	}

	getName(constructor: typeof HTMLElement) {
		for (const [name, el] of this.#elements) {
			if (el.constructor == constructor) return name;
		}
	}
}