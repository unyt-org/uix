import type { appMetadata } from "./app.ts";

export function getInjectedAppDataStandalone() {
	// get injected uix app metadata
	const appDataContent = ((globalThis as any).document)?.querySelector("script[type=uix-app]")?.textContent
	const appData = appDataContent ? JSON.parse(appDataContent) as {[key in keyof appMetadata]: appMetadata[key]} : undefined;
	return appData;
}