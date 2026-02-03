import { Component, type ReactNode } from "react";

import { signalAppFallback } from "@/lib/app-recovery";

const CHUNK_ERROR_REGEX =
  /Failed to fetch dynamically imported module|Importing a module script failed/i;

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

  componentDidCatch(error: Error) {
    // Detectar si es un error de chunk
    if (CHUNK_ERROR_REGEX.test(error.message)) {
      signalAppFallback("chunk");
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}
