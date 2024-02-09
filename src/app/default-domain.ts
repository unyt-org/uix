import { Datex } from "datex-core-legacy/mod.ts";

export function getDefaultDomainPrefix() {
	return Datex.Unyt.endpointDomains()[0] ?? '';
}