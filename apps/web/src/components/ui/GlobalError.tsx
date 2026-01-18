import { Component, ErrorInfo, ReactNode } from "react";

import { logger } from "@/lib/logger";

import Button from "./Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  hasError: boolean;
  isReloading: boolean;
}

// Errores que indican un nuevo deploy (cache stale)
const DEPLOY_ERROR_PATTERNS = [
  "is not a valid JavaScript MIME type",
  "Failed to fetch dynamically imported module",
  "Loading chunk",
  "Loading CSS chunk",
  "Unexpected token '<'",
  "ChunkLoadError",
];

export class GlobalError extends Component<Props, State> {
  public state: State = {
    error: null,
    hasError: false,
    isReloading: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("Uncaught error:", { error, errorInfo });

    // Si es un error de deploy, no recargar automáticamente.
    // Dejar que el render muestre la UI de "Nueva versión" con un botón manual.
    if (isDeployError(error)) {
      logger.info("[GlobalError] 🔄 Deploy error detected, waiting for user action...");
    }
  }

  public render(): React.JSX.Element {
    if (this.state.hasError) {
      const isDeployIssue = isDeployError(this.state.error);

      // Si es error de deploy, mostrar UI mínima mientras recarga
      if (isDeployIssue || this.state.isReloading) {
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
                <h1 className="text-base-content text-2xl font-bold tracking-tight">Actualización Lista</h1>
                <p className="text-base-content/60 px-4 text-sm leading-relaxed">
                  Hemos mejorado el sistema. Para disfrutar de las últimas mejoras, necesitamos reiniciar la aplicación.
                </p>
              </div>

              <div className="mt-8">
                <Button
                  className="btn-lg ring-primary/20 w-full rounded-2xl shadow-lg ring"
                  onClick={this.handleAutoReload}
                >
                  {this.state.isReloading ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          fill="currentColor"
                        />
                      </svg>
                      Actualizando...
                    </span>
                  ) : (
                    "Actualizar Ahora"
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      }

      // Error genérico - mostrar UI completa
      return (
        <div className="bg-base-100 flex min-h-screen flex-col items-center justify-center p-4 text-center">
          <div className="max-w-md space-y-6">
            <div className="bg-error/10 text-error mx-auto flex h-20 w-20 items-center justify-center rounded-full">
              <svg
                className="h-10 w-10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="space-y-2">
              <h1 className="text-base-content text-3xl font-bold">Algo salió mal</h1>
              <p className="text-base-content/60">
                Ha ocurrido un error inesperado. Hemos registrado el problema y nuestro equipo lo revisará.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-base-200 rounded-xl p-4 text-left">
                <p className="text-error font-mono text-xs break-all">{this.state.error.toString()}</p>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button onClick={() => this.handleAutoReload()}>Recargar página</Button>
              <Button onClick={() => (globalThis.location.href = "/")} variant="secondary">
                Ir al inicio
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }

  private handleAutoReload = async () => {
    if (this.state.isReloading) return;
    this.setState({ isReloading: true });

    try {
      await clearCaches();
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (import.meta.env.DEV) {
        console.debug("Dev mode: preventing reload in GlobalError");
        this.setState({ isReloading: false });
      } else {
        globalThis.location.reload();
      }
    } catch {
      this.setState({ isReloading: false });
    }
  };
}

async function clearCaches() {
  if ("caches" in globalThis) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }
}

function isDeployError(error: Error | null): boolean {
  if (!error) return false;
  const message = error.toString();
  return DEPLOY_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}
