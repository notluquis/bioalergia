const BUILD_ID = "__BUILD_ID__";
const CACHE_NAME = `finanzas-v${BUILD_ID}`;
const RUNTIME_CACHE = `runtime-${BUILD_ID}`;

// Assets críticos para offline
const STATIC_ASSETS = ["/", "/index.html", "/manifest.json"];

// Rutas que SIEMPRE van a la red primero (datos dinámicos)
const NETWORK_FIRST_ROUTES = ["/api/"];

// ============= INSTALACIÓN =============
self.addEventListener("install", (event) => {
  console.log("[SW] Installing version:", BUILD_ID);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Forzar activación inmediata (no esperar a cerrar tabs)
  self.skipWaiting();
});

// ============= ACTIVACIÓN =============
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating version:", BUILD_ID);
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Borrar TODOS los caches viejos (diferente BUILD_ID)
              const isOldCache = !name.includes(BUILD_ID);
              if (isOldCache) {
                console.log("[SW] Deleting old cache:", name);
              }
              return isOldCache;
            })
            .map((name) => caches.delete(name))
        );
      })
      .then(() => {
        console.log("[SW] Claiming clients");
        return self.clients.claim();
      })
  );
});

// ============= MENSAJES (para forzar actualización) =============
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("[SW] Skip waiting requested");
    self.skipWaiting();
  }
  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: BUILD_ID });
  }
});

// ============= FETCH =============
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar requests del mismo origin
  if (url.origin !== location.origin) return;

  // API calls: SIEMPRE network first (datos frescos)
  if (NETWORK_FIRST_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets (JS, CSS, images): Stale-while-revalidate
  // Esto sirve del cache PERO actualiza en background
  event.respondWith(staleWhileRevalidate(request));
});

// ============= ESTRATEGIA: Network First =============
// Para APIs - siempre intentar red primero
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Cachear solo respuestas OK
    if (response.ok && request.method === "GET") {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Si falla red, intentar cache
    const cached = await caches.match(request);
    if (cached) {
      console.log("[SW] Network failed, serving from cache:", request.url);
      return cached;
    }
    throw error;
  }
}

// ============= ESTRATEGIA: Stale While Revalidate =============
// Sirve del cache inmediatamente pero actualiza en background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Fetch en paralelo (actualizar cache en background)
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((err) => {
      console.log("[SW] Fetch failed for:", request.url, err);
      return null;
    });

  // Si tenemos cache, devolver inmediatamente
  // El fetch en background actualizará para la próxima vez
  if (cached) {
    return cached;
  }

  // Si no hay cache, esperar el fetch
  const response = await fetchPromise;
  if (response) return response;

  // Fallback: página offline
  if (request.mode === "navigate") {
    const offlinePage = await cache.match("/");
    if (offlinePage) return offlinePage;
  }

  return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
}

// ============= PUSH NOTIFICATIONS =============
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Finanzas App";
  const options = {
    body: data.body || "Nueva notificación",
    icon: data.icon || "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    data: data.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // Check if url matches (ignoring query params if needed, but simple check for now)
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
