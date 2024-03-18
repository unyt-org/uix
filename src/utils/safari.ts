export function isSafariClient(request:Request){
	const ua = request.headers.get("user-agent");
	if (!ua) return true; // play it safe
	return /^((?!chrome|android).)*safari/i.test(ua);
}