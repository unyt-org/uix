// TODO:
// /**
//  * Wrap a CSS document with a custom scope selector
//  * @param css css document
//  * @param scope scope selector
//  * @returns 
//  */
// export function addCSSScopeSelector(css: string, scope: string) {
// 	// TODO: not working with @keyframes
// 	return `${scope} {\n${
// 		'    ' + 
// 		css
// 			.replaceAll(':host', '&')
// 			.replaceAll('\n', '\n    ')
// 	}\n}`;
// }

// export function addCSSScope(css: string) {
// 	return addCSSScopeSelector(css, "@scope")
// }

/**
 * Add a scope selector everywhere in a CSS document
 * @param css css document
 * @param scope scope selector
 * @returns 
 */
export function addCSSScopeSelector(css: string, scope: string) {
	const scopedCSS = css.replace(/^[^@\n]+{[^}]*}/gm, (part) => {
		if (part.match(/^(to|from|\d+%|[\s,\n])+{[^}]*}$/)) return part; // is inside @keyframe (e.g. "50% {}""), ignore
		else {
			// for each selectors (e.g. ':host, a#b'), add the scope, e.g. 'scope, scope a#b'
			return part.replace(/^[^@\n]+(?={)/, (s) => {
				const selectors = s.split(/, */g).map(selector => 
					(selector.includes(":host") || selector.includes(":root")) ? 
						selector
							.trimEnd()
							.replace(/\:(host|root)\s*\:host-context/g, ':host-context')
							.replace(/\:(host|root)(?![-\w])/g, scope) : 
						scope + ' ' + selector.trimEnd()
					);
				return selectors.join(", ") + ' '
			})
		}
	});
	return scopedCSS;
}

export function addCSSScope(css: string) {
	return "@scope {\n" + css + "\n}";
}