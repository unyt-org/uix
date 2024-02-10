import { UIX } from "../../../uix.ts";

UIX.Theme.useTheme("uix-dark");

(document as any).body.append(
	<div style="padding: 15px;">
		<h1>UIX Debugging Tools</h1>
		<ul>
			<li><a href="/@debug/logs">Backend Logs</a></li>
			<li><a href="/@debug/network">Network Status</a></li>
		</ul>
	</div>
);