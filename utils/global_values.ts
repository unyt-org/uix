import { Datex } from "unyt_core";
import { client_type } from "unyt_core/utils/constants.ts";

export const logger = new Datex.Logger("UIX");

// main container
export const root_container = client_type === "browser" ?
	( <HTMLElement> document.querySelector("#main") ?? document.body.shadowRoot?.querySelector("#main") ?? document.createElement("slot"))
	: null;

if (client_type === "browser") {
	root_container!.id = "main"
	// init body shadow root
	if (!document.body.shadowRoot) {
		document.body.attachShadow({mode:'open'});
		document.body.shadowRoot!.append(root_container!);
	}
}


// notification container
export const notification_container = client_type === "browser" ? document.createElement("aside") : null;

if (client_type === "browser") {
	notification_container!.classList.add("notification-container");
	document.body.shadowRoot!.append(notification_container!)
}
