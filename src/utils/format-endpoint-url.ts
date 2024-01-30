import type { Datex } from "datex-core-legacy/mod.ts";

export function formatEndpointURL(endpoint:Datex.Endpoint) {
	const endpointName = endpoint.toString();
	if (endpointName.startsWith("@+")) return `${endpointName.replace("@+","")}.unyt.app`
	else if (endpointName.startsWith("@@")) return `${endpointName.replace("@@","")}.unyt.app`
	else if (endpointName.startsWith("@")) return `${endpointName.replace("@","")}.unyt.me`
}