// deno-lint-ignore-file no-control-regex
import { HTML } from "./src/html/template-strings.ts";
import { SCSS, css } from "./src/utils/css-template-strings.ts";


/** make decorators global */
import { bindToOrigin } from "./src/app/datex-over-http.ts";
import { content as _content, bindOrigin as _bindOrigin, id as _id, layout as _layout, child as _child, use as _use, NoResources as _NoResources, standalone as _standalone} from "./src/base/decorators.ts";
import { domUtils } from "./src/app/dom-context.ts";
import { template as _template, blankTemplate as _blankTemplate } from "./src/html/template.ts";
import { style as _style } from "./src/html/style.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";

import "./src/utils/window-apis.ts";

// TODO: remove
export {unsafeHTML} from "./src/html/unsafe-html.ts";

declare global {
	const id: typeof _id;
	const layout: typeof _layout;
	const content: typeof _content;
	const value: typeof _child;
	const NoResources: typeof _NoResources;
	const standalone: typeof _standalone;
	const bindOrigin: typeof _bindOrigin;
	const template: typeof _template;
	const blankTemplate: typeof _blankTemplate;
	const style: typeof _style;
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
globalThis.standalone = _standalone;
// @ts-ignore global
globalThis.bindOrigin = _bindOrigin;
// @ts-ignore global
globalThis.template = _template;
// @ts-ignore global
globalThis.blankTemplate = _blankTemplate;
// @ts-ignore global
globalThis.style = _style;


// @ts-ignore global HTML
globalThis.HTML = HTML;
// @ts-ignore global HTML
globalThis.SCSS = SCSS;
// @ts-ignore global HTML
globalThis.css = css;


/**
 * bind to origin in function prototype
 */

const _HTML = HTML;
const _SCSS = SCSS;
const _css = css;

declare global {

	const HTML: typeof _HTML;
	/**
	 * @deprecated, use css
	 */
	const SCSS: typeof _SCSS;
	const css: typeof _css;

	// interface CallableFunction {
	// 	bindToOrigin<T, A extends unknown[], R>(this: (this: T, ...args: A) => R, context?:any): (...args: A)=>Promise<Awaited<Promise<R>>>;
	// }
}

// // @ts-ignore
// Function.prototype.bindToOrigin = function (this:(...args: any)=>any, context:any) {
// 	return bindToOrigin(this, context);
// }