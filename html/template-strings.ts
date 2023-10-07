import { getHTMLGenerator } from "uix/uix-dom/html-template-strings/html_template_strings.ts";
import { domContext, domUtils } from "uix/app/dom-context.ts";
import { jsx } from "uix/jsx-runtime";

export const HTML = getHTMLGenerator(domContext, domUtils, jsx)