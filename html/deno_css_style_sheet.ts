// Used instead of jsdom CSSStyleSheet in deno
export class CSSStyleSheet implements globalThis.CSSStyleSheet {

	replace() {

	}

	replaceSync() {

	}

	cssRules:CSSStyleRule[] = []

}

export class CSSStyleRule implements globalThis.CSSStyleRule{
	cssText = ""
}
