import { usePostHog } from "posthog-js/react";
import { useEffect, useRef } from "react";

/**
 * Hook para rastrear cuando una sección se vuelve visible en el viewport
 * Dispara un evento de PostHog una sola vez cuando el elemento entra en viewport
 */
export function useTrackSectionView(sectionId: string, sectionName: string) {
  const posthog = usePostHog();
  const elementRef = useRef<HTMLElement | null>(null);
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (!elementRef.current || !posthog || hasTrackedRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedRef.current) {
          posthog.capture("section_viewed", {
            section_id: sectionId,
            section_name: sectionName,
            timestamp: new Date().toISOString(),
          });
          hasTrackedRef.current = true;
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(elementRef.current);

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, [posthog, sectionId, sectionName]);

  return elementRef;
}
