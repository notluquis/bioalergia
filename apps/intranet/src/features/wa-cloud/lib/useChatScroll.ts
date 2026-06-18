import { useCallback, useLayoutEffect, useRef, useState } from "react";

const AT_BOTTOM_THRESHOLD_PX = 80;

export type ChatScroll = {
  /** Attach to the scroll container's `onScroll`. */
  onScroll: () => void;
  /** Whether to show the "scroll to bottom" FAB (user has scrolled up). */
  showFab: boolean;
  /** Messages that arrived while the user was scrolled up (badge on the FAB). */
  newCount: number;
  /** Programmatic scroll to the latest message. */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  /** Live ref: is the viewport currently pinned near the bottom? */
  isAtBottomRef: React.RefObject<boolean>;
};

// Owns all scroll-position logic for the message feed so ConversationDetail
// stays a thin controller. The core rule that fixes the "yanked to the bottom
// while reading history" bug: only auto-scroll on new messages when the user
// is already near the bottom OR the new tail is our own outbound send. When the
// operator has scrolled up to read older messages, incoming messages preserve
// their position and bump a `newCount` badge instead.
export function useChatScroll(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  {
    messageCount,
    lastMessageOut,
    enabled = true,
  }: { messageCount: number; lastMessageOut: boolean; enabled?: boolean }
): ChatScroll {
  const isAtBottomRef = useRef(true);
  const [showFab, setShowFab] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const prevCountRef = useRef(messageCount);
  const rafRef = useRef<number | null>(null);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
      isAtBottomRef.current = true;
      setShowFab(false);
      setNewCount(0);
    },
    [scrollRef]
  );

  const onScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      const atBottom = dist <= AT_BOTTOM_THRESHOLD_PX;
      isAtBottomRef.current = atBottom;
      setShowFab(!atBottom);
      if (atBottom) setNewCount(0);
    });
  }, [scrollRef]);

  // React to message-count growth. useLayoutEffect so we decide before paint
  // whether to pin to bottom (avoids a visible jump).
  useLayoutEffect(() => {
    const grew = messageCount > prevCountRef.current;
    const added = messageCount - prevCountRef.current;
    prevCountRef.current = messageCount;
    // Keep prevCount synced even while disabled (initial open hasn't "landed"
    // yet) so we don't treat the whole backlog as new once enabled.
    if (!enabled || !grew) return;
    if (isAtBottomRef.current || lastMessageOut) {
      scrollToBottom("smooth");
    } else {
      setNewCount((c) => c + added);
      setShowFab(true);
    }
  }, [messageCount, lastMessageOut, enabled, scrollToBottom]);

  return { onScroll, showFab, newCount, scrollToBottom, isAtBottomRef };
}
