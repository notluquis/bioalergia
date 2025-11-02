import React from "react";
import Button from "./Button";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: unknown }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  componentDidCatch(_error: unknown, _errorInfo: unknown) {
    // Hook opcional para reportar a un sistema de errores.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-base-200 p-6">
          <div className="card w-full max-w-3xl bg-base-100 shadow-lg">
            <div className="card-body">
              <div className="flex items-center gap-4">
                <img src="/logo.png" alt="Logo" className="h-12" />
                <h2 className="card-title text-(--brand-primary)">¡Ups! Ocurrió un error inesperado</h2>
              </div>
              <p className="text-base-content">
                Por favor, recarga la página o contacta al soporte si el problema persiste.
              </p>
              <pre className="bg-base-200 rounded p-2 text-xs text-red-600 max-w-full overflow-auto my-2">
                {String(this.state.error)}
              </pre>
              <div className="card-actions justify-end">
                <Button onClick={() => window.location.reload()}>Recargar</Button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
