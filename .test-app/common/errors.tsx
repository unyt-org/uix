import { renderStatic } from "uix/html/render-methods.ts";

export const invalid = renderStatic(
	<div style="margin:10px">
		Invalid path, example components are available under:
		<ul>
			<li><code>/componentName/backend+dynamic</code></li>
			<li><code>/componentName/backend+static</code></li>
			<li><code>/componentName/backend+staticnojs</code></li>
			<li><code>/componentName/backend+hydrated</code></li>
			<li><code>/componentName/frontend</code></li>
		</ul>
	</div>);
