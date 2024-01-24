import { domUtils, domContext } from "../app/dom-context.ts";
import { enableJSX } from "../uix-dom/jsx/mod.ts";

const {jsx:_jsx, jsxs:_jsxs, Fragment:_Fragment} = enableJSX(domContext, domUtils);

export const jsx = _jsx;
export const jsxs = _jsxs;
export const Fragment = _Fragment;

// make jsx available on globalThis
Object.defineProperties(globalThis, {
	_jsx: {value: jsx},
	_jsxs: {value: jsxs},
	_Fragment: {value: Fragment},
})