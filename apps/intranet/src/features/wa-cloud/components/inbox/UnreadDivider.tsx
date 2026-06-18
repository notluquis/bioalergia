// "N mensajes nuevos" separator dropped before the first unread inbound message
// when a conversation opens, so the operator lands where they left off instead
// of at the very bottom. role="separator" + aria-label so screen readers
// announce the boundary (WAI-ARIA APG log pattern).
export function UnreadDivider({ count }: { count: number }) {
  const label =
    count > 0 ? `${count} ${count === 1 ? "mensaje nuevo" : "mensajes nuevos"}` : "Mensajes nuevos";
  return (
    <div
      className="flex items-center gap-2 py-1"
      role="separator"
      aria-label={label}
      data-unread-divider
    >
      <span className="h-px flex-1 bg-success/40" />
      <span className="rounded-full bg-success/15 px-2 py-0.5 font-medium text-success text-xs">
        {label}
      </span>
      <span className="h-px flex-1 bg-success/40" />
    </div>
  );
}
