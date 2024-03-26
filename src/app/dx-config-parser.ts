import { Datex, datex } from "datex-core-legacy/no_init.ts"; // required by getAppConfig
import type { Datex as _Datex } from "datex-core-legacy"; // required by getAppConfig

import type {Datex as DatexType} from "datex-core-legacy";
import { Path } from "datex-core-legacy/utils/path.ts";
import { normalizedAppOptions } from "../app/options.ts";
import { formatEndpointURL } from "datex-core-legacy/utils/format-endpoint-url.ts";

async function readDXConfigData(path: URL) {
	const dx = (await Datex.Runtime.getURLContent(path, false, false) ?? {}) as Record<string,any>;
	const requiredLocation: DatexType.Endpoint = Datex.Ref.collapseValue(Datex.DatexObject.get(dx, 'location'), true, true) ?? Datex.LOCAL_ENDPOINT;
	const stageEndpoint: DatexType.Endpoint = Datex.Ref.collapseValue(Datex.DatexObject.get(dx, 'endpoint'), true, true) ?? Datex.LOCAL_ENDPOINT;
	const port: number = Datex.Ref.collapseValue(Datex.DatexObject.get(dx, 'port'), true, true);
	const instances: number = Datex.Ref.collapseValue(Datex.DatexObject.get(dx, 'instances'), true, true) ?? 1;
	let volumes: URL[]|undefined = Datex.Ref.collapseValue(Datex.DatexObject.get(dx, 'volumes'), true, true);
	if (!volumes) volumes = []
	else if (!(volumes instanceof Array)) volumes = [volumes];

	let domains:string[] = Datex.Ref.collapseValue(Datex.DatexObject.get(dx, 'domain'), true, true);
	// make sure customDomains is a string array
	if (domains instanceof Datex.Tuple) domains = domains.toArray();
	else if (typeof domains == "string") domains = [domains];
	// @ts-ignore check for default @@local
	else if (domains === Datex.LOCAL_ENDPOINT) domains = [];
	domains = domains?.filter(d=>d!==Datex.LOCAL_ENDPOINT) ?? [];

	return {
		port,
		requiredLocation,
		stageEndpoint,
		domains,
		volumes,
		instances
	}
}


export async function getDXConfigData(backend: Path, options:normalizedAppOptions) {

	const backendDxFile = backend.getChildPath(".dx");

	let requiredLocation: DatexType.Endpoint|undefined;
	let stageEndpoint: DatexType.Endpoint|undefined;
	let volumes: URL[]|undefined
	let instances = 1;
	const domains:Record<string, number|null> = {}; // domain name -> internal port

	if (backendDxFile.fs_exists) {
		let backendDomains: string[]|undefined;
		({requiredLocation, stageEndpoint, domains: backendDomains, volumes, instances} = await readDXConfigData(backendDxFile))
		for (const domain of backendDomains) {
			domains[domain] = null; // no port mapping specified per default
		}
	}

	// map frontend ports
	let autoPort = 80;
	for (const frontend of options.frontend) {
		const frontendDxFile = frontend.getChildPath(".dx");
		if (frontendDxFile.fs_exists) {
			const {domains: frontendDomains, port} = await readDXConfigData(frontendDxFile);

			if (frontendDomains) {
				const domainPort = port ?? autoPort++;
				for (const domain of frontendDomains) {
					domains[domain] = domainPort; // no port mapping specified per default
				}
			}
		}
	}


	// add unyt.app domain for stageEndpoint
	if (stageEndpoint && stageEndpoint !== Datex.LOCAL_ENDPOINT) {
		const endpointURL = formatEndpointURL(stageEndpoint);
		if (endpointURL) domains[endpointURL] = null;
	}

	return {
		requiredLocation,
		stageEndpoint,
		volumes,
		domains,
		instances
	}
}