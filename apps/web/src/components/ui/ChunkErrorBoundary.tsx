import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary para capturar errores de carga de chunks (dynamic imports)
 * Patrón estándar en React 2025 para manejar code-splitting failures
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Chunk load error caught:", error, errorInfo);

    // Detectar si es un error de chunk y hacer log
    if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(error.message)) {
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
        <div className="bg-base-200 flex min-h-screen items-center justify-center p-4">
          <div className="card bg-base-100 w-full max-w-md shadow-xl">
            <div className="card-body text-center">
              <div className="mb-4 flex justify-center">
                <div className="bg-error/10 relative flex h-16 w-16 items-center justify-center rounded-full">
                  <svg className="text-error h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="card-title text-error justify-center">Actualización Disponible</h2>
              <p className="text-base-content/70 mt-2 text-sm">
                Se ha publicado una nueva versión. Para continuar, necesitamos recargar la página.
              </p>
              <p className="text-base-content/50 mt-4 text-xs break-all">
                {this.state.error?.message || "Error desconocido"}
              </p>
              <div className="card-actions mt-6 justify-center">
                <button onClick={this.handleReset} className="btn btn-primary btn-sm">
                  Recargar Página
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
