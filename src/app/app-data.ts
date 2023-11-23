import { Datex } from "datex-core-legacy/mod.ts";
import { UIX } from "../../uix.ts";
import { logger } from "../utils/global-values.ts";
import { getInjectedAppDataStandalone } from "./app-data-standalone.ts";

export function getInjectedAppData() {
	// get injected uix app metadata
	const appData = getInjectedAppDataStandalone()
	
	// compare current backend and frontend version
	if (appData?.backendLibVersions) {
		if (appData.backendLibVersions.uix !== UIX.version) {
			logger.warn(`The current UIX version on this client (${UIX.version}) does not match the backend version (${appData.backendLibVersions.uix}).\nYou might need to update your browser caches or restart your backend.`)
		}
		if (appData.backendLibVersions.datex !== Datex.Runtime.VERSION) {
			logger.warn(`The current DATEX Core version on this client (${Datex.Runtime.VERSION}) does not match the backend version (${appData.backendLibVersions.datex}).\nYou might need to update your browser caches or restart your backend.`)
		}
	}

	return appData;
}

export function getInjectedImportmap() {
	// get import map from <script type=importmap>
	const importMapContent = ((globalThis as any).document)?.querySelector("script[type=importmap]")?.textContent
	if (importMapContent) {
		return JSON.parse(importMapContent) as {imports:Record<string,string>};
	}
}