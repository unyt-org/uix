/**
 * Wrap a CSS document with a custom scope selector
 * @param css css document
 * @param scope scope selector
 * @returns 
 */
export function addCSSScopeSelector(css: string, scope: string) {
	// TODO: not working with @keyframes
	return `${scope} {\n${
		'    ' + 
		css
			.replaceAll(':host', '&')
			.replaceAll('\n', '\n    ')
	}\n}`;
}

export function addCSSScope(css: string) {
	return addCSSScopeSelector(css, "@scope")
}