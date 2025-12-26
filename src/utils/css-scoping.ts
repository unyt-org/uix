/**
 * Wrap a CSS document with a custom scope selector
 * @param css css document
 * @param scope scope selector
 * @returns 
 */
export function addCSSScopeSelector(css: string, scope: string) {
  // remove block comments to avoid mis-detection of at-rule blocks
  css = removeBlockComments(css);
	// first extract all @-rule blocks except @media and move them outside of the scope
	const atBlocks: string[] = [];
	const normalizedCSS = replaceAtRuleBlocks(css, (block) => {
		if (block.startsWith("@media")) return block; // keep @media blocks inside the scope
		atBlocks.push(block);
		return `/* [[UIX moved ${block.split(" ")[0]}]] */`;
	});

	// wrap the rest with the scope and append the extracted @-rule blocks at the end
	return `${atBlocks.join('\n\n')}\n\n${scope} {\n${
		'    ' + 
		normalizedCSS
			.replaceAll(':host', '&')
			.replaceAll(':root', '&')
			.replaceAll('\n', '\n    ')
	}\n}\n`;
}

function removeBlockComments(cssText: string): string {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Helper function to replace at-rule blocks in CSS text
function replaceAtRuleBlocks(cssText: string, replacer: (block: string) => string): string {
  const resultParts = [];
  let lastIndex = 0;
  const atRuleRegex = /@[a-zA-Z\-]+[^{]*\{/g;
  let match;

  while ((match = atRuleRegex.exec(cssText)) !== null) {
    const start = match.index;
    let i = atRuleRegex.lastIndex - 1;
    let braceCount = 1;

    // Walk through text to find matching closing brace
    while (++i < cssText.length && braceCount > 0) {
      if (cssText[i] === '{') braceCount++;
      else if (cssText[i] === '}') braceCount--;
    }

    const end = i;
    const block = cssText.slice(start, end);
    const replacement = replacer(block);

    // Push preceding text and replaced block
    resultParts.push(cssText.slice(lastIndex, start), replacement);
    lastIndex = end;
  }

  // Append remaining text
  resultParts.push(cssText.slice(lastIndex));
  return resultParts.join('');
}


// legacy implementation for addCSSScopeSelector
// /**
//  * Add a scope selector everywhere in a CSS document
//  * @param css css document
//  * @param scope scope selector
//  * @returns 
//  */
// export function addCSSScopeSelector(css: string, scope: string) {
// 	const scopedCSS = css.replace(/^[^@\n]+{[^}]*}/gm, (part) => {
// 		if (part.match(/^(to|from|\d+%|[\s,\n])+{[^}]*}$/)) return part; // is inside @keyframe (e.g. "50% {}""), ignore
// 		else {
// 			// for each selectors (e.g. ':host, a#b'), add the scope, e.g. 'scope, scope a#b'
// 			return part.replace(/^[^@\n]+(?={)/, (s) => {
// 				const selectors = s.split(/, */g).map(selector => 
// 					(selector.includes(":host") || selector.includes(":root")) ? 
// 						selector
// 							.trimEnd()
// 							.replace(/\:(host|root)\s*\:host-context/g, ':host-context')
// 							.replace(/\:(host|root)(?![-\w])/g, scope) : 
// 						scope + ' ' + selector.trimEnd()
// 					);
// 				return selectors.join(", ") + ' '
// 			})
// 		}
// 	});
// 	return scopedCSS;
// }

export function addCSSScope(css: string) {
	return "@scope {\n" + css + "\n}";
}

// export function addCSSScope(css: string) {
// 	return addCSSScopeSelector(css, "@scope")
// }