const swUrl = new URL(self.location.href);
const BUILD_ID = swUrl.searchParams.get("build") ?? "dev";
const CACHE_NAME = `finanzas-${BUILD_ID}`;
const STATIC_ASSETS = ["/", "/index.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

// Network-first routes (always try network first for these)
const NETWORK_FIRST_ROUTES = ["/api/auth", "/api/transactions", "/api/services/agenda", "/api/employees"];

// Install - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch strategy router
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Network-first for critical API routes
  if (NETWORK_FIRST_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Network-first for all API calls (except those we cache)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for static assets (HTML, CSS, JS, images)
  event.respondWith(cacheFirst(request));
});

// Cache-first strategy with network fallback
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    // Return cached response immediately
    return cached;
  }

  try {
    // Fetch from network
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Network failed, try cache again (might have been added meanwhile)
    const cachedFallback = await cache.match(request);
    if (cachedFallback) {
      return cachedFallback;
    }

    // Return offline page for navigation requests
    if (request.mode === "navigate") {
      const offlinePage = await cache.match("/");
      if (offlinePage) return offlinePage;
    }

    throw error;
  }
}

// Network-first strategy with cache fallback
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    // Try network first
    const response = await fetch(request);

    // Cache successful responses for future offline access
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Network failed, fallback to cache
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    throw error;
  }
}
