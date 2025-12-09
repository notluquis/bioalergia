/**
 * Service Worker update manager
 * Detecta actualizaciones del SW y maneja errores de carga de chunks
 * Patrón recomendado por la comunidad en 2025
 */

export function initSWUpdateListener() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready
    .then((registration) => {
      // Escuchar cambios en el SW
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // Nueva versión disponible, mostrar notificación
            console.info("New app version available. Reload to update.", newWorker);
            // El usuario puede recargar cuando lo desee
            // No forzamos reload automático para no interrumpir su sesión
          }
        });
      });

      // Chequear updates regularmente
      setInterval(() => {
        registration.update();
      }, 60000); // Cada minuto
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
