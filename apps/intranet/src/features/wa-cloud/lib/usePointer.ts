import { useCallback, useEffect, useRef, useState } from "react";

// Coarse-pointer (touch) detection, SSR-safe. Mirrors the matchMedia lifecycle
// used by `useIsMobile` in WaCloudInboxPage but keyed on input modality rather
// than viewport width — a tablet in landscape is wide AND touch, and message
// actions must be reachable there. Returns false during SSR / first paint.
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setIsTouch(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isTouch;
}

export type LongPressHandlers = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
};

const MOVE_CANCEL_PX = 10;

// WhatsApp-native gesture: press-and-hold on a message opens its action sheet.
// Fires `onLongPress` after `delay` ms unless the pointer moves past
// MOVE_CANCEL_PX (a scroll, not a press) or lifts early. Suppresses the iOS
// long-press text-selection callout via contextmenu preventDefault. The
// returned `didFire` ref lets the bubble swallow the click that follows a
// long-press so it doesn't double-trigger a tap handler.
export function usePointerLongPress(
  onLongPress: (e: React.PointerEvent) => void,
  opts: { delay?: number; enabled?: boolean } = {}
): { handlers: LongPressHandlers; didFire: React.RefObject<boolean> } {
  const { delay = 300, enabled = true } = opts;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const didFire = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.pointerType === "mouse") return;
      didFire.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        didFire.current = true;
        onLongPress(e);
        clear();
      }, delay);
    },
    [clear, delay, enabled, onLongPress]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const o = origin.current;
      if (!o) return;
      if (
        Math.abs(e.clientX - o.x) > MOVE_CANCEL_PX ||
        Math.abs(e.clientY - o.y) > MOVE_CANCEL_PX
      ) {
        clear();
      }
    },
    [clear]
  );

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    // Only suppress the native callout when our long-press actually armed/fired
    // on a touch device; leave desktop right-click alone.
    if (didFire.current || origin.current) e.preventDefault();
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: clear,
      onPointerLeave: clear,
      onContextMenu,
    },
    didFire,
  };
}
