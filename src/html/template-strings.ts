import { getHTMLGenerator } from "../uix-dom/html-template-strings/html_template_strings.ts";
import { domContext, domUtils } from "../app/dom-context.ts";
import { jsx } from "../jsx-runtime/jsx.ts";

export const HTML = getHTMLGenerator(domContext, domUtils, jsx)