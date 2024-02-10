import { DebugLogs } from "./logs-backend.ts";
import { app } from "../app.ts"
import { convertANSIToHTML } from "../../utils/ansi-to-html.ts";
import { unsafeHTML } from "../../html/unsafe-html.ts";

const messageLoggerEnabled = $$(false);
const verboseLogsEnabled = $$(false);

const logsContainer = <div style="width:100%;overflow:scroll;"></div>
const component = <div style="height:100vh;overflow: hidden;padding:20px;display: flex;flex-direction: column;">
	<div style="user-select: none;margin-bottom:10px;padding:10px;background:var(--bg-content);border-radius:10px;display:flex;gap:10px;align-items: center;">
		<label style="display:flex;align-items: center;">
			<input type="checkbox" checked={messageLoggerEnabled} style="margin: 0 5px;"/>
			Enable Message Logger
		</label>
		<label style="display:flex;align-items: center;">
			<input type="checkbox" checked={verboseLogsEnabled} style="margin: 0 5px;"/>
			Enable Verbose Logs
		</label>
		<button style="margin-left: auto;border: none;margin-bottom: 0;background:var(--red)" onclick={()=>logsContainer.innerHTML=""}>Clear logs</button>
		<button style="border: none;margin-bottom: 0;" onclick={()=>logsContainer.scrollTo(0, logsContainer.scrollHeight)}>Scroll to bottom</button>
	</div>
	<b style="margin-bottom:20px;">
		Backend Logs ({app.backend?.toString()})
	</b>
	{logsContainer}
</div>;

effect(() => {
	if (messageLoggerEnabled.val) DebugLogs.enableMessageLogger.to(app.backend!)();
	else DebugLogs.disableMessageLogger.to(app.backend!)();
});

effect(() => {
	if (verboseLogsEnabled.val) DebugLogs.enableVerboseLogs.to(app.backend!)();
	else DebugLogs.disableVerboseLogs.to(app.backend!)();
});


(document as any).body.appendChild(component);
(document as any).body.style.margin = "0";

const stream = await DebugLogs.getLogs.to(app.backend!)();

const reader = stream.getReader();

while (true) {
	const val = await reader.read();
	const child = <span style="display:flex;gap:20px;">
		<span style="color:var(--text-light);white-space: nowrap;">{new Date().toLocaleTimeString()}</span>
		<span>{unsafeHTML(convertANSIToHTML(val.value as string))}</span>
	</span>;
	const scrollDown = Math.abs(logsContainer.scrollHeight - logsContainer.scrollTop - logsContainer.clientHeight) < 1;
	logsContainer.appendChild(child);
	setTimeout(() => {
		if (scrollDown) {
			logsContainer.scrollTo(0, logsContainer.scrollHeight);
		}
	}, 10);
	if (val.done) break;
}

