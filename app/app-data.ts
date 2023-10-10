import { appMetadata } from "./app.ts";

export function getInjectedAppData() {
	// get injected uix app metadata
	const appDataContent = ((globalThis as any).document)?.querySelector("script[type=uix-app]")?.textContent
	if (appDataContent) {
		return JSON.parse(appDataContent) as {[key in keyof appMetadata]: string};
	}
}

export function getInjectedImportmap() {
	// get import map from <script type=importmap>
	const importMapContent = ((globalThis as any).document)?.querySelector("script[type=importmap]")?.textContent
	if (importMapContent) {
		return JSON.parse(importMapContent) as {imports:Record<string,string>};
	}
}