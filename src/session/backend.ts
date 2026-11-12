import { Datex } from "datex-core-legacy/mod.ts";

const sessions = new Map<Datex.Endpoint, Set<string>>().setAutoDefault(Set)
const unverifiedSessions = new Map<Datex.Endpoint, Set<string>>().setAutoDefault(Set)

export function createSession(endpoint: Datex.Endpoint, verified = true) {
	// SECURITY: cryptographically secure random session token (Math.random() is predictable)
	const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
	if (verified) sessions.getAuto(endpoint.main).add(token)
	else unverifiedSessions.getAuto(endpoint.main).add(token)
	return token;
}

export function validateVerifiedSession(endpoint: Datex.Endpoint, token: string) {
	return sessions.getAuto(endpoint.main).has(token)
}

export function validateUnverifiedSession(endpoint: Datex.Endpoint, token: string) {
	// SECURITY: previously returned the result of Map.delete() for invalid tokens (true if a session existed),
	// which accepted any token for endpoints with an unverified session
	return unverifiedSessions.get(endpoint.main)?.has(token) ?? false;
}

export function unverifiedSessionExists(endpoint: Datex.Endpoint) {
	return unverifiedSessions.has(endpoint.main)
}