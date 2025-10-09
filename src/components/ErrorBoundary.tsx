import React from "react";

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: unknown }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  componentDidCatch(_error: unknown, _errorInfo: unknown) {
    // Hook para logging externo si se requiere.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white/80">
          <img src="/logo.png" alt="Logo" className="h-16 mb-4" />
          <h2 className="text-2xl font-bold text-[var(--brand-primary)] mb-2">¡Ups! Ocurrió un error inesperado</h2>
          <p className="text-slate-600 mb-4">
            Por favor, recarga la página o contacta al soporte si el problema persiste.
          </p>
          <pre className="bg-slate-100 rounded p-2 text-xs text-red-600 max-w-xl overflow-auto">
            {String(this.state.error)}
          </pre>
          <button
            className="mt-6 px-4 py-2 rounded bg-[var(--brand-primary)] text-white font-semibold"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
