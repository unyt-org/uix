import { DebugNetwork } from "./network-backend.ts";
import { convertANSIToHTML } from "../../utils/ansi-to-html.ts";
import { app } from "../app.ts";
import { UIX } from "../../../uix.ts";

UIX.Theme.useTheme("uix-dark");

const endpoint = $$("")

const status = <div style="background: var(--accent-bg);border-radius: 10px;padding: 15px;"></div>;
const endpointSockets = <div></div>
const container = <div>
	{status}
	<div style="display:flex;gap:10px;margin:20px 0px;">
		<input type="text" value={endpoint} style="width:500px"/>
		<input type="button" value="Get Endpoint Sockets" onclick={updateEndpointSockets}/>
	</div>
	{endpointSockets}
</div>


const getComStatus = DebugNetwork.getComStatus.to(app.backend!)
const getEndpointSockets = DebugNetwork.getEndpointSockets.to(app.backend!)

async function updateContent() {
	const content = await getComStatus();
	status.innerHTML = convertANSIToHTML(content)
}

async function updateEndpointSockets() {
	const content = await getEndpointSockets(endpoint.val);
	endpointSockets.innerHTML = convertANSIToHTML(content)
}


updateContent();
setInterval(updateContent, 3000);

(document as any).body.append(container);