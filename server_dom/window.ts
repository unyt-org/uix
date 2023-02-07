import {CSSStyleSheet} from "./css_style_sheet.ts";

import { JSDOM } from "https://jspm.dev/npm:jsdom-deno@19.0.1";


export const { window }: {window:globalThis.Window} = new JSDOM(
  `<!DOCTYPE html>
  <html lang="en">
	<head></head>
	<body></body>
  </html>`,
	{
	  contentType: "text/html",
	  storageQuota: 10000000,
	},
);

window.CSSStyleSheet = CSSStyleSheet;

export const document = window.document