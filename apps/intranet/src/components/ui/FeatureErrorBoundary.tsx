import { Button } from "@heroui/react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { type ErrorInfo, type ReactNode } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import { logger } from "@/lib/logger";

/**
 * Granular error boundary for a single feature surface (modal, wizard,
 * card, panel). Use this INSIDE a route to scope a crash to one section
 * instead of blowing up the entire route via TanStack Router's
 * defaultErrorComponent.
 *
 * 2026 pattern: defense in depth. The router's defaultErrorComponent stays
 * as the last-resort safety net; granular boundaries upstream let users
 * recover from feature-local bugs without losing context (a wizard mid-
 * flow, a half-filled form, an open inbox conversation).
 *
 * Usage:
 *   <FeatureErrorBoundary featureName="CreateShipmentWizard" onClose={onClose}>
 *     <ActualWizardContents />
 *   </FeatureErrorBoundary>
 *
 * `featureName` lands in the logger context so prod errors are filterable
 * by feature. `onClose` is optional — when provided the fallback adds a
 * "Cerrar" button (useful inside dialogs/modals so the user can dismiss
 * the broken UI without reloading the page).
 */
function FeatureErrorFallback({
  error,
  resetErrorBoundary,
  featureName,
  onClose,
}: FallbackProps & {
  featureName: string;
  onClose?: () => void;
}) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl border border-danger/30 bg-danger/5 p-6 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle size={28} aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-base text-foreground">Algo salió mal en {featureName}</h3>
        <p className="text-default-600 text-sm">
          Esta sección no se pudo cargar. El error fue registrado para revisión.
        </p>
      </div>
      <details className="w-full max-w-md text-left">
        <summary className="cursor-pointer text-default-500 text-xs hover:text-default-700">
          Detalles técnicos
        </summary>
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-default-100 p-2 font-mono text-[10px] text-default-700">
          {message}
        </pre>
      </details>
      <div className="flex gap-2">
        <Button onPress={resetErrorBoundary} size="sm" variant="primary">
          <RotateCcw size={14} aria-hidden="true" />
          Reintentar
        </Button>
        {onClose && (
          <Button onPress={onClose} size="sm" variant="outline">
            Cerrar
          </Button>
        )}
      </div>
    </div>
  );
}

interface FeatureErrorBoundaryProps {
  featureName: string;
  onClose?: () => void;
  /**
   * Optional reset key — when this value changes the boundary resets so the
   * same feature can re-mount with new state (e.g. switching to a different
   * record without leaving the surrounding route).
   */
  resetKey?: string | number;
  children: ReactNode;
}

export function FeatureErrorBoundary({
  featureName,
  onClose,
  resetKey,
  children,
}: FeatureErrorBoundaryProps) {
  const handleError = (error: unknown, info: ErrorInfo) => {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[FeatureErrorBoundary:${featureName}]`, {
      error: err,
      componentStack: info.componentStack,
      feature: featureName,
    });
  };

  return (
    <ErrorBoundary
      FallbackComponent={(props) => (
        <FeatureErrorFallback {...props} featureName={featureName} onClose={onClose} />
      )}
      onError={handleError}
      resetKeys={resetKey != null ? [resetKey] : undefined}
    >
      {children}
    </ErrorBoundary>
  );
}
