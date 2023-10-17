

const cacheName = 'js13yPWA-v1';


// reset cache
async function clearCache() {
	console.log('[Service Worker] Clearing cache...');
	const keys = await caches.keys();
	return keys.map(async (cache) => {
		console.log('[Service Worker] Removing old cache: '+cache);
		return await caches.delete(cache);
	})
}


self.addEventListener('install', (e) => {
	console.log('[Service Worker] installed');
});

self.addEventListener('activate', event => {
	event.waitUntil(clearCache());
})

self.addEventListener('fetch', (e) => {
	e.waitUntil((async () => {
		const r = await caches.match(e.request);
		console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
		if (r) { return r; }
		const response = await fetch(e.request);
		const responseCopy = response.clone();
		if (!responseCopy.ok) {
			console.log(`[Service Worker] Error fetching resource: ${e.request.url}`);
			return;
		}
		const cache = await caches.open(cacheName);
		console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
		return cache.put(e.request, responseCopy);
	})());
});

self.addEventListener('message', (event) => {
	if (event.data?.type === 'clear_cache') {
		event.waitUntil(clearCache())
	}
});