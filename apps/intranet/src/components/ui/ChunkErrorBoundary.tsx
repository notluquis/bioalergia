import { type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { signalAppFallback } from "@/lib/app-recovery";

const CHUNK_ERROR_REGEX =
  /Failed to fetch dynamically imported module|Importing a module script failed/i;

function handleChunkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (CHUNK_ERROR_REGEX.test(message)) {
    signalAppFallback("chunk");
  }
}

export function ChunkErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallback={null} onError={handleChunkError}>
      {children}
    </ErrorBoundary>
  );
}
