import { Card, Description } from "@heroui/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { signalAppFallback } from "@/lib/app-recovery";
import { logger } from "@/lib/logger";

import { Button } from "./Button";

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
      signalAppFallback("update");
    }
  }

  public render(): React.JSX.Element {
    if (this.state.hasError) {
      const isDeployIssue = isDeployError(this.state.error);

      // Error genérico o de deploy - mostrar UI con opción de recarga
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
          <Card className="max-w-md space-y-6 border-none bg-transparent shadow-none">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-danger/10 text-danger">
              <svg
                className="h-10 w-10"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>Dismiss</title>
                <path
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="space-y-2">
              <Card.Title className="font-bold text-3xl text-foreground">
                {isDeployIssue ? "Nueva versión disponible" : "Algo salió mal"}
              </Card.Title>
              <Card.Description className="text-default-500">
                {isDeployIssue
                  ? "Hay una nueva versión de la aplicación. Por favor, recarga la página para actualizar."
                  : "Ha ocurrido un error inesperado. Hemos registrado el problema y nuestro equipo lo revisará."}
              </Card.Description>
            </div>

            {!isDeployIssue && this.state.error && (
              <div className="rounded-xl bg-default-50 p-4 text-left">
                <Description className="whitespace-pre-wrap break-all font-mono text-danger text-xs">
                  {this.state.error.toString()}
                </Description>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button
                onClick={() => this.handleAutoReload()}
                isLoading={this.state.isReloading}
                variant="primary"
              >
                {this.state.isReloading ? "Recargando..." : "Recargar página"}
              </Button>
              {!isDeployIssue && (
                <Button onClick={() => (globalThis.location.href = "/")} variant="secondary">
                  Ir al inicio
                </Button>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }

  private handleAutoReload = async () => {
    if (this.state.isReloading) {
      return;
    }
    this.setState({ isReloading: true });

    try {
      await clearCaches();
      await new Promise((resolve) => setTimeout(resolve, 500));
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      if (!import.meta.env.DEV) {
        globalThis.location.reload();
      } else {
        this.setState({ isReloading: false });
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
  if (!error) {
    return false;
  }
  const message = error.toString();
  return DEPLOY_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}
