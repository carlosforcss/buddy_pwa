const CACHE_NAME = 'pwa-demo-v2';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/mobile.js',
    '/manifest.json'
];

// Install service worker and cache assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                // Force the waiting service worker to become the active service worker
                return self.skipWaiting();
            })
    );
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});

// Fetch resources from cache or network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Don't cache API requests (port 3000) or WebSocket upgrades
    if (url.port === '3000' || 
        url.pathname.startsWith('/conversations/') ||
        event.request.headers.get('upgrade') === 'websocket') {
        console.log('Service Worker: Bypassing cache for API request:', event.request.url);
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Cache static assets only
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                if (response) {
                    console.log('Service Worker: Serving from cache:', event.request.url);
                    return response;
                }
                
                console.log('Service Worker: Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        // Only cache successful responses for static assets
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Only cache GET requests for static files
                        if (event.request.method === 'GET' && 
                            (event.request.url.includes('.js') || 
                             event.request.url.includes('.css') || 
                             event.request.url.includes('.html') ||
                             event.request.url.includes('.json'))) {
                            
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        }

                        return response;
                    });
            })
            .catch(() => {
                // Return offline fallback for HTML requests only
                if (event.request.destination === 'document') {
                    return caches.match('/offline.html');
                }
            })
    );
}); 