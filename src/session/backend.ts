import { Datex } from "datex-core-legacy/mod.ts";

const sessions = new Map<Datex.Endpoint, Set<string>>().setAutoDefault(Set)
const unverifiedSessions = new Map<Datex.Endpoint, Set<string>>().setAutoDefault(Set)

export function createSession(endpoint: Datex.Endpoint, verified = true) {
	const token = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
		.replaceAll('x', function (c) {
			const r = Math.random() * 16 | 0, 
				v = c == 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	if (verified) sessions.getAuto(endpoint.main).add(token)
	else unverifiedSessions.getAuto(endpoint.main).add(token)
	return token;
}

export function validateVerifiedSession(endpoint: Datex.Endpoint, token: string) {
	return sessions.getAuto(endpoint.main).has(token)
}

export function validateUnverifiedSession(endpoint: Datex.Endpoint, token: string) {
	return unverifiedSessions.getAuto(endpoint.main).has(token)
}

export function unverifiedSessionExists(endpoint: Datex.Endpoint) {
	return unverifiedSessions.has(endpoint.main)
}