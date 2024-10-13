import { Datex } from "datex-core-legacy/mod.ts";

/**
 * Redirects to the given URL, after all outgoing DATEX updates have been sent.
 * This should be used instead of globalThis.location.href = "..."
 * to ensure that all DATEX updates are sent before the redirect.
 * @param url the new URL to redirect to
 */
export async function redirect(url: string | URL) {
	await Datex.Runtime.synchronized;
	globalThis.location.href = url.toString();
}

// @ts-ignore globalThis
globalThis.redirect = redirect;

type redirectT = typeof redirect;
declare global {
	/**
	 * Redirects to the given URL, after all outgoing DATEX updates have been sent.
	 * This should be used instead of globalThis.location.href = "..."
	 * to ensure that all DATEX updates are sent before the redirect.
	 * @param url the new URL to redirect to
	 */
	const redirect: redirectT;
}