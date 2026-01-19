import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  hasError: boolean;
}

/**
 * Error Boundary para capturar errores de carga de chunks (dynamic imports)
 * Patrón estándar en React 2025 para manejar code-splitting failures
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Chunk load error caught:", error, errorInfo);

    // Detectar si es un error de chunk y hacer log
    if (
      /Failed to fetch dynamically imported module|Importing a module script failed/i.test(
        error.message,
      )
    ) {
      console.warn("Dynamic import failed. A new version may be available. Consider reloading.");
    }
  }

  handleReset = async () => {
    try {
      // 1. Desregistrar Service Workers
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
      // 3. Recargar la página (Manual action)
      globalThis.location.reload();
    }
  };

  render(): React.JSX.Element {
    if (this.state.hasError) {
      return (
        <div className="bg-base-100/50 fixed inset-0 z-9999 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-base-100 border-base-200 w-full max-w-sm overflow-hidden rounded-[2.5rem] border p-8 text-center shadow-2xl">
            <div className="bg-primary/10 text-primary ring-primary/5 mx-auto mb-6 flex h-24 w-24 animate-pulse items-center justify-center rounded-full ring-8">
              <svg
                className="h-12 w-12"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="space-y-3">
              <h1 className="text-base-content text-2xl font-bold tracking-tight">
                Acción Requerida
              </h1>
              <p className="text-base-content/60 px-4 text-sm leading-relaxed">
                Se detectó una nueva versión de Bioalergia. Necesitamos recargar la aplicación para
                activarla.
              </p>
            </div>

            <div className="mt-8">
              <button
                className="btn btn-primary btn-lg ring-primary/20 w-full rounded-2xl shadow-lg ring"
                onClick={this.handleReset}
              >
                Actualizar Ahora
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
