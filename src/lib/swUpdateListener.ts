/**
 * Service Worker update manager
 * Detecta actualizaciones del SW y maneja errores de carga de chunks
 * Patrón recomendado por la comunidad en 2025
 */

export function initSWUpdateListener() {
  if (!("serviceWorker" in navigator)) return;

  let hasShownUpdateNotification = false;

  navigator.serviceWorker.ready
    .then((registration) => {
      // Escuchar cambios en el SW
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // Nueva versión disponible, mostrar notificación SOLO UNA VEZ
            if (!hasShownUpdateNotification) {
              console.info("New app version available. Reload to update.", newWorker);
              hasShownUpdateNotification = true;
              // El usuario puede recargar cuando lo desee
              // No forzamos reload automático para no interrumpir su sesión
            }
          }
        });
      });

      // Chequear updates con menos frecuencia y solo si hay cambios reales
      setInterval(
        () => {
          // Solo chequear si no hay un update pendiente y el SW está activo
          if (registration && !registration.waiting && !registration.installing) {
            registration.update().catch(() => {
              // Silently fail - normal state issues or offline
            });
          }
        },
        5 * 60 * 1000
      ); // Cada 5 minutos (más razonable que cada minuto)
    })
    .catch((err) => {
      console.debug("SW registration not ready:", err);
    });
}

/**
 * Maneja errores de módulos dinámicos fallados
 * Redirige a página de error amigable en lugar de mostrar solo "Error loading app"
 */
export function handleChunkLoadError(error: Error): void {
  const message = error.message;
  const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed/i.test(message);

  if (isChunkError) {
    console.warn("Chunk load failed:", message);
    // Redirigir a página de actualización
    window.location.href = "/chunk-load-error";
  }
}
