const handleRetry = async () => {
  try {
    // 1. Desregistrar Service Workers para evitar cache stale
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    // 2. Limpiar todas las caches
    if ("caches" in globalThis) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.error("Error clearing cache:", error);
  } finally {
    // 3. Recargar la página forzando fetch al servidor
    globalThis.location.reload();
  }
};

import { Button } from "@/components/ui/Button";
export function ChunkLoadErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-default-50 p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning/10">
            <svg
              aria-hidden="true"
              className="h-10 w-10 text-warning"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Error Icon</title>
              <path
                d="M12 9v2m0 4v2m0 0v2m-6-4h12M7.5 3h9A2.5 2.5 0 0119 5.5v13A2.5 2.5 0 0116.5 21h-9A2.5 2.5 0 015 18.5v-13A2.5 2.5 0 017.5 3z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="font-bold text-3xl text-foreground">Actualización Necesaria</h1>
          <p className="mt-2 text-default-600 text-sm">
            Se ha detectado una nueva versión de la aplicación. Por favor, recarga la página para
            continuar.
          </p>
        </div>

        {/* Details */}
        <div className="rounded-lg bg-background/50 p-4 text-left">
          <p className="mb-2 font-mono text-default-500 text-xs">Detalles técnicos:</p>
          <ul className="space-y-1 text-default-400 text-xs">
            <li>• Falló al cargar un módulo dinámico</li>
            <li>• La versión anterior ya no está disponible</li>
            <li>• Usa el botón de abajo para actualizar</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button fullWidth variant="primary" onPress={handleRetry}>
            Recargar Ahora
          </Button>
          <Button
            fullWidth
            variant="ghost"
            className="text-xs"
            onPress={() => (globalThis.location.href = "/login")}
          >
            Ir a Login
          </Button>
        </div>

        {/* Footer */}
        <p className="text-default-300 text-xs">
          Si el problema persiste, contacta al administrador.
        </p>
      </div>
    </div>
  );
}
