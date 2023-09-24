import { UIX } from "uix";
import { HTTPStatus } from "uix/html/http-status.ts";

export const invalid = 
	UIX.provideErrorMessage(
		"Invalid path", 
		"Example components are available under:", 
		<div style="margin:10px">
			<ul>
				<li><code>/componentName/backend+dynamic</code></li>
				<li><code>/componentName/backend+static</code></li>
				<li><code>/componentName/backend+hydrated</code></li>
				<li><code>/componentName/frontend</code></li>
			</ul>
		</div>
	)
;
export const notFound = UIX.provideError("Path not found", HTTPStatus.NOT_FOUND);