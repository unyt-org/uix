import {communicationHub} from "datex-core-legacy/network/communication-hub.ts";

@endpoint export class DebugNetwork {
	@property static getComStatus() {
		return communicationHub.handler.getStatus()
	}

	@property static getEndpointSockets(endpoint: string) {
		return communicationHub.handler.getEndpointSockets(endpoint)
	}
}