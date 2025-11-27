import { Component, ErrorInfo, ReactNode } from "react";
import Button from "./Button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalError extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
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
              <Button onClick={() => window.location.reload()}>Recargar página</Button>
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
