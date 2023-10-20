// deno-lint-ignore-file no-control-regex
import { Datex } from "datex-core-legacy";
import { HTML } from "./src/html/template-strings.ts";
import { SCSS } from "./src/utils/css-template-strings.ts";


/** make decorators global */
import { bindToOrigin } from "./src/utils/datex-over-http.ts";
import { content as _content, bindOrigin as _bindOrigin, id as _id, layout as _layout, child as _child, use as _use, NoResources as _NoResources, frontend as _frontend} from "./src/base/decorators.ts";
import { Theme } from "./src/base/theme.ts";
import { domUtils } from "./src/app/dom-context.ts";

declare global {
	const content: typeof _content;
	const id: typeof _id;
	const layout: typeof _layout;
	const child: typeof _child;
	const NoResources: typeof _NoResources;
	const frontend: typeof _frontend;
	const bindOrigin: typeof _bindOrigin;
}

// @ts-ignore global
globalThis.content = _content;
// @ts-ignore global
globalThis.id = _id;
// @ts-ignore global
globalThis.child = _child;
// @ts-ignore global
globalThis.layout = _layout;
// @ts-ignore global
globalThis.NoResources = _NoResources;
// @ts-ignore global
globalThis.frontend = _frontend;
// @ts-ignore global
globalThis.bindOrigin = _bindOrigin;

// get Theme Color
export function C (name:TemplateStringsArray|string, ...params:string[]) {
	return Theme.getColorReference(typeof name == "string" ? name : name?.raw[0])
}

export function unsafeHTML(html:string, content?: Datex.RefOrValue<HTMLElement>|(Datex.RefOrValue<HTMLElement>)[]) {
	return domUtils.createHTMLElement(html, content)
}

// @ts-ignore global HTML
globalThis.HTML = HTML;
// @ts-ignore global HTML
globalThis.SCSS = SCSS;


/**
 * bind to origin in function prototype
 */

const _HTML = HTML;
const _SCSS = SCSS;

declare global {

	const HTML: typeof _HTML;
	const SCSS: typeof _SCSS;

	interface CallableFunction {
		bindToOrigin<T, A extends unknown[], R>(this: (this: T, ...args: A) => R, context?:any): (...args: A)=>Promise<Awaited<Promise<R>>>;
	}
}

// @ts-ignore
Function.prototype.bindToOrigin = function (this:(...args: any)=>any, context:any) {
	return bindToOrigin(this, context);
}