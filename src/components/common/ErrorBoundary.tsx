import React from "react";
import Button from "../ui/Button";

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

  componentDidCatch(error: unknown, errorInfo: unknown) {
    // Hook opcional para reportar a un sistema de errores.
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-base-200/60 via-base-100 to-base-100 p-6">
          <div className="surface-elevated w-full max-w-3xl p-8">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Logo" className="brand-logo" />
              <h2 className="text-2xl font-semibold text-primary drop-shadow-sm">¡Ups! Ocurrió un error inesperado</h2>
            </div>
            <p className="mt-4 text-sm text-base-content">
              Por favor, recarga la página o contacta al soporte si el problema persiste.
            </p>
            <pre className="mt-4 max-h-48 overflow-auto rounded-2xl bg-base-200/80 p-3 text-xs text-error">
              {String(this.state.error)}
            </pre>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => window.location.reload()}>Recargar</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
