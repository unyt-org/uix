/**
 * SECURITY: returns false if a request was sent by another site (CSRF).
 * Uses the Sec-Fetch-Site and Origin headers (set by browsers, cannot be modified by websites).
 * Requests without these headers (non-browser clients, old browsers) are accepted.
 */
export function isSameOriginRequest(request: Request) {
	const secFetchSite = request.headers.get("Sec-Fetch-Site");
	if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") return false;
	const origin = request.headers.get("Origin");
	if (origin && origin !== "null") {
		try {
			if (new URL(origin).host !== new URL(request.url).host) return false;
		}
		catch {
			return false;
		}
	}
	else if (origin === "null") return false;
	return true;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * SECURITY (CSRF): session cookies are sent with cross-site requests (SameSite=None),
 * so state-changing requests (POST, PUT, DELETE, ...) that carry cookies must come from the same origin.
 * Requests without cookies (e.g. token based APIs called from other origins) are not affected.
 */
export function isForbiddenCrossSiteRequest(request: Request) {
	if (SAFE_METHODS.has(request.method.toUpperCase())) return false;
	if (!request.headers.has("Cookie")) return false;
	return !isSameOriginRequest(request);
}
