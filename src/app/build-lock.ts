import { logger } from "../utils/global-values.ts";

let buildLocks: Promise<void>[] = [];

/**
 * Register a build lock, indicating that files are being built.
 * Build locks are await during hot reloading before reloading the web pages
 * @param lock 
 */
export function registerBuildLock(lock: Promise<void>) {
	buildLocks.push(lock);
}

/**
 * Await all build locks to finish
 */
export async function waitForBuildLocks() {
	let finished = false;
	const locks = Promise.race([
		Promise.allSettled(buildLocks),
		sleep(15_000).then(() => {
			if (!finished) logger.warn("Some build proceses did not finish after 15 seconds. Continuing...");
		})
	]);
	await locks;
	finished = true;
	buildLocks = [];
}