
/**
 * Auto indent template strings:
 * ```ts
 * indent `
 *    first line, indentation is removed
 *    second line, also no indentation
 *       * item - relative indentation to first line is kept
 *       * also indented item
 * `
 * ```
 * Optional default indentation offset:
 * ```ts
 * indent(4) `
 * indented with 4 spaces
 * also indented with 4 spaces
 * `
 * ```
 * 
 * @param string template string
 * @param insert 
 */

const BASE_INDENT = Symbol("BASE_INDENT")

export function indent(string:TemplateStringsArray, ...insert:(any|undefined)[]): string
export function indent(base_indentation:number): (string:TemplateStringsArray, ...insert:(any|undefined)[]) => string
export function indent(string:TemplateStringsArray|number, _base_indent?:any|{[BASE_INDENT]:number}, ...insert:(any|undefined)[]) {
	
	// create indent function with base indent
	if (typeof string == "number") return (_string:TemplateStringsArray, ...insert:(string|undefined)[])=>indent(_string, {[BASE_INDENT]:<any>string}, ...insert)

	let base_indent = 0;
	// extract base indent
	if (typeof _base_indent == "object" && BASE_INDENT in _base_indent) {
		base_indent = _base_indent[BASE_INDENT];
	}
	// base_indent not used, use as insert string
	else {
		insert = [_base_indent, ...insert]; 
	}

	const tab_as_space = '    ';
	const remove_indentation = string[0].replace(/\t/gm, tab_as_space).match(/\n*(\s*)/)?.[1].length ?? 0;

	let combined = "";

	for (let i=0; i<string.length; i++) {
		let nstring = string[i];
		// if (i == 0) nstring = nstring.trimStart(); // remove line breaks at beginning
		// if (i == string.length-1) nstring = nstring.trimEnd(); // remove line breaks at end
		nstring = nstring.replace(/\t/gm, tab_as_space);
		const line_indentation = nstring.match(/\n*(\s*)/)?.[1].length ?? 0;
		combined += nstring.replace(new RegExp('\\n\\s{'+remove_indentation+'}', 'gm'), '\n').replace(/\n/gm, '\n' + ' '.repeat(base_indent));
		if (i < insert.length) combined += insert[i]?.toString()?.replace(/\n/gm, '\n' + ' '.repeat(base_indent+Math.max(0,line_indentation-remove_indentation))) ?? '';
	}

	return combined;
}