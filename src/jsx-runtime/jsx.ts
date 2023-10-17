import { domUtils, domContext } from "../app/dom-context.ts";
import { enableJSX } from "../uix-dom/jsx/mod.ts";

const {jsx:_jsx, jsxs:_jsxs, Fragment:_Fragment} = enableJSX(domContext, domUtils);

export const jsx = _jsx;
export const jsxs = _jsxs;
export const Fragment = _Fragment;