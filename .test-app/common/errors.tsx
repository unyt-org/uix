import { renderBackend } from "uix/html/render-methods.ts";

export const invalid = renderBackend(
	<div style="margin:10px">
		Invalid path, example components are available under:
		<ul>
			<li><code>/componentName/static</code></li>
			<li><code>/componentName/backend</code></li>
			<li><code>/componentName/hybrid</code></li>
			<li><code>/componentName/dynamic</code></li>
			<li><code>/componentName/frontend</code></li>
		</ul>
	</div>);
