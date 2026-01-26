import { Component, type ErrorInfo, type ReactNode } from "react";

import { signalAppFallback } from "@/lib/app-recovery";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error Boundary para capturar errores de carga de chunks (dynamic imports)
 * Patrón estándar en React 2025 para manejar code-splitting failures
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
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
      signalAppFallback("chunk");
    }
  }

  render(): React.JSX.Element {
    if (this.state.hasError) {
      return <></>;
    }

    return <>{this.props.children}</>;
  }
}
