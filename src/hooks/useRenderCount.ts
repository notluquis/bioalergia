import { useEffect, useRef } from "react";

/**
 * Custom hook para trackear renders de componentes (solo en desarrollo).
 * Útil para debugging de re-renders excesivos.
 *
 * @param componentName - Nombre del componente para identificar en logs
 * @example
 * ```tsx
 * function MyComponent() {
 *   useRenderCount("MyComponent");
 *   // ...
 * }
 * ```
 */
export function useRenderCount(componentName: string): void {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;

    // Solo loggear en modo desarrollo
    if (import.meta.env.DEV) {
      console.log(`[RenderCount] ${componentName} rendered: ${renderCount.current} times`);
    }
  }, [componentName]);
}

/**
 * Hook para detectar por qué un componente se re-renderizó.
 * Compara props/state previos con actuales y loggea diferencias.
 *
 * @param componentName - Nombre del componente
 * @param props - Object con props/state a trackear
 * @example
 * ```tsx
 * function MyComponent({ userId, filters }) {
 *   useWhyDidYouUpdate("MyComponent", { userId, filters });
 *   // ...
 * }
 * ```
 */
export function useWhyDidYouUpdate(componentName: string, props: Record<string, unknown>): void {
  const previousProps = useRef<Record<string, unknown> | undefined>(undefined);

  useEffect(() => {
    if (import.meta.env.DEV && previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, { from: unknown; to: unknown }> = {};

      allKeys.forEach((key) => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length > 0) {
        console.log(`[WhyDidYouUpdate] ${componentName} re-rendered due to:`, changedProps);
      }
    }

    previousProps.current = props;
  }, [componentName, props]);
}
