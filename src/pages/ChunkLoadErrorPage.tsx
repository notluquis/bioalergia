export default function ChunkLoadErrorPage() {
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
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
    } finally {
      // 3. Recargar la página forzando fetch al servidor
      window.location.reload();
    }
  };

  return (
    <div className="bg-base-200 flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="bg-warning/10 flex h-20 w-20 items-center justify-center rounded-full">
            <svg className="text-warning h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4v2m0 0v2m-6-4h12M7.5 3h9A2.5 2.5 0 0119 5.5v13A2.5 2.5 0 0116.5 21h-9A2.5 2.5 0 015 18.5v-13A2.5 2.5 0 017.5 3z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-base-content text-3xl font-bold">Actualización Necesaria</h1>
          <p className="text-base-content/70 mt-2 text-sm">
            Se ha detectado una nueva versión de la aplicación. Por favor, recarga la página para continuar.
          </p>
        </div>

        {/* Details */}
        <div className="bg-base-100/50 rounded-lg p-4 text-left">
          <p className="text-base-content/60 mb-2 font-mono text-xs">Detalles técnicos:</p>
          <ul className="text-base-content/50 space-y-1 text-xs">
            <li>• Falló al cargar un módulo dinámico</li>
            <li>• La versión anterior ya no está disponible</li>
            <li>• Usa el botón de abajo para actualizar</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button onClick={handleRetry} className="btn btn-primary w-full">
            Recargar Ahora
          </button>
          <button onClick={() => (window.location.href = "/login")} className="btn btn-ghost w-full text-xs">
            Ir a Login
          </button>
        </div>

        {/* Footer */}
        <p className="text-base-content/40 text-xs">Si el problema persiste, contacta al administrador.</p>
      </div>
    </div>
  );
}
