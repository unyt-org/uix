import { UIX } from "uix";

export const invalid = UIX.renderStatic(<div style="margin:10px">Invalid path, use <code>/:component/backend+(dynamic|static|hydrated)</code> or <code>/:component/frontend</code></div>);
export const notFound = UIX.renderStatic(<div style="margin:10px">Path not found</div>);