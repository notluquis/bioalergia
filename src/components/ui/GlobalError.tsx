import { Component, ErrorInfo, ReactNode } from "react";
import Button from "./Button";
import { clearAllCaches } from "@/lib/serviceWorker";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isReloading: boolean;
}

// Errores que indican un nuevo deploy (cache stale)
const DEPLOY_ERROR_PATTERNS = [
  "is not a valid JavaScript MIME type",
  "Failed to fetch dynamically imported module",
  "Loading chunk",
  "Loading CSS chunk",
  "Unexpected token '<'", // HTML returned instead of JS
  "ChunkLoadError",
];

function isDeployError(error: Error | null): boolean {
  if (!error) return false;
  const message = error.toString();
  return DEPLOY_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export class GlobalError extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isReloading: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // Si es un error de deploy, recargar automáticamente
    if (isDeployError(error)) {
      console.log("[GlobalError] 🔄 Deploy error detected, auto-reloading...");
      this.handleAutoReload();
    }
  }

  private handleAutoReload = async () => {
    if (this.state.isReloading) return;

    this.setState({ isReloading: true });

    try {
      // Limpiar todos los caches
      await clearAllCaches();

      // Pequeño delay para que se vea el estado
      await new Promise((r) => setTimeout(r, 500));

      // Forzar recarga completa
      window.location.reload();
    } catch (e) {
      console.error("[GlobalError] Auto-reload failed:", e);
      this.setState({ isReloading: false });
    }
  };

  public render() {
    if (this.state.hasError) {
      const isDeployIssue = isDeployError(this.state.error);

      // Si es error de deploy, mostrar UI mínima mientras recarga
      if (isDeployIssue || this.state.isReloading) {
        return (
          <div className="flex min-h-screen flex-col items-center justify-center bg-base-100 p-4 text-center">
            <div className="max-w-md space-y-6">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg
                  className="h-10 w-10 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-base-content">Nueva versión detectada</h1>
                <p className="text-base-content/60">Actualizando la aplicación...</p>
              </div>
            </div>
          </div>
        );
      }

      // Error genérico - mostrar UI completa
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-base-100 p-4 text-center">
          <div className="max-w-md space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-error/10 text-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-10 w-10"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-base-content">Algo salió mal</h1>
              <p className="text-base-content/60">
                Ha ocurrido un error inesperado. Hemos registrado el problema y nuestro equipo lo revisará.
              </p>
            </div>

            {this.state.error && (
              <div className="rounded-xl bg-base-200 p-4 text-left">
                <p className="font-mono text-xs text-error break-all">{this.state.error.toString()}</p>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button onClick={() => this.handleAutoReload()}>
                {this.state.isReloading ? "Recargando..." : "Recargar página"}
              </Button>
              <Button variant="secondary" onClick={() => (window.location.href = "/")}>
                Ir al inicio
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
