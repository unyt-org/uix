import { Datex } from "datex-core-legacy";
import { client_type } from "datex-core-legacy/utils/constants.ts";

export const logger = new Datex.Logger("UIX");

// main container
export const root_container = client_type === "browser" ?
	( <HTMLElement> document.querySelector("template > slot") ?? document.body.shadowRoot?.querySelector(":host > slot") ?? document.createElement("slot"))
	: null;

if (client_type === "browser") {
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
