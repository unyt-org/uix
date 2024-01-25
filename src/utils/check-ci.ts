const CI_INDICATOR_VARS = [
	'CI',
	'GITLAB_CI',
	'GITHUB_ACTIONS'
]

export function isCIRunner() {
	for (const ciVar of CI_INDICATOR_VARS) {
		if (Deno.env.has(ciVar)) return true;
	}
	return false;
}