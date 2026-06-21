import { formatChile } from "@/lib/dates";
import { Button } from "@heroui/react";
import { MessageSquareText, MoreVertical, RotateCw } from "lucide-react";
import { useState } from "react";
import { MediaAttachment } from "./MediaAttachment";
import { MessageActionMenu, MessageActionSheet, type MessageActionsApi } from "./MessageActions";
import {
  ContactsBubble,
  ForwardedBadge,
  InteractiveBubble,
  LocationBubble,
  UnsupportedBubble,
} from "./SpecialMessage";
import { type MessageStatus, StatusTicks } from "../shared/_shared";
import { useIsTouch, usePointerLongPress } from "../../lib/usePointer";

export type ChatBubbleRow = {
  messageId: number | null;
  metaMessageId: string | null;
  out: boolean;
  body: string | null;
  type: string;
  timestamp: Date;
  status: MessageStatus;
  errorTitle?: string | null;
  errorDetails?: string | null;
  templateName?: string | null;
  quotedSnippet?: { body: string; out: boolean } | null;
  reactions?: { emoji: string; out: boolean }[];
  payload?: unknown;
  // Consecutive-message grouping flags (default true = standalone bubble).
  groupStart?: boolean;
  groupEnd?: boolean;
  // Client id for optimistic rows, so retry can target the right pending entry.
  pendingCid?: string | null;
};

const FORWARDABLE_TYPES = new Set([
  "TEXT",
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "DOCUMENT",
  "STICKER",
  "LOCATION",
  "CONTACTS",
]);

const STATUS_LABEL: Record<MessageStatus, string> = {
  PENDING: "enviando",
  SENT: "enviado",
  DELIVERED: "entregado",
  READ: "leído",
  FAILED: "falló",
};

export function ChatBubble({
  row,
  contactName,
  onReply,
  onReact,
  onEdit,
  onRetry,
  onForward,
  onSaveSticker,
}: {
  row: ChatBubbleRow;
  contactName: string;
  onReply: (row: {
    metaMessageId: string | null;
    body: string | null;
    type: string;
    out: boolean;
  }) => void;
  onReact: (row: { metaMessageId: string | null; out: boolean }, emoji: string) => void;
  onEdit: (row: { messageId: number | null; body: string | null }) => void;
  onRetry?: (row: ChatBubbleRow) => void;
  onForward?: (row: ChatBubbleRow) => void;
  onSaveSticker?: (row: ChatBubbleRow) => void;
}) {
  const out = row.out;
  const isPending = row.status === "PENDING";
  const failed = row.status === "FAILED";
  const isTouch = useIsTouch();
  const [actionsOpen, setActionsOpen] = useState(false);

  const wrapper = out ? "justify-end" : "justify-start";
  const canInteract = row.metaMessageId !== null;
  const canEdit =
    out &&
    row.type === "TEXT" &&
    row.messageId !== null &&
    Date.now() - row.timestamp.getTime() < 15 * 60 * 1000;
  const canRetry = failed && Boolean(onRetry);
  const canSaveSticker =
    !out && row.type === "STICKER" && row.messageId !== null && Boolean(onSaveSticker);
  const ownReaction = row.reactions?.find((r) => r.out)?.emoji ?? null;
  const hasActions = canInteract || canRetry || canSaveSticker;

  const groupStart = row.groupStart ?? true;
  const groupEnd = row.groupEnd ?? true;

  const isSticker = row.type === "STICKER";
  const bubbleColor = isSticker
    ? "bg-transparent"
    : out
      ? failed
        ? "bg-danger text-danger-foreground"
        : "bg-success text-success-foreground"
      : "bg-content1 text-foreground border border-default-200";
  const radius = isSticker
    ? ""
    : out
      ? "rounded-l-2xl rounded-tr-2xl"
      : "rounded-r-2xl rounded-tl-2xl";
  const isMedia = ["IMAGE", "STICKER", "VIDEO", "AUDIO", "DOCUMENT"].includes(row.type);
  const fallbackLabel = row.templateName
    ? `[plantilla] ${row.templateName}`
    : `[${row.type.toLowerCase()}]`;

  const api: MessageActionsApi = {
    canReact: canInteract,
    canReply: canInteract,
    canEdit,
    canForward:
      Boolean(onForward) &&
      row.messageId !== null &&
      FORWARDABLE_TYPES.has(row.type) &&
      (row.type !== "TEXT" || Boolean(row.body)),
    canRetry,
    canSaveSticker,
    body: row.body,
    ownReaction,
    onReact: (emoji) => onReact({ metaMessageId: row.metaMessageId, out }, emoji),
    onReply: () =>
      onReply({ metaMessageId: row.metaMessageId, body: row.body, type: row.type, out }),
    onEdit: () => onEdit({ messageId: row.messageId, body: row.body }),
    onForward: () => onForward?.(row),
    onRetry: () => onRetry?.(row),
    onSaveSticker: () => onSaveSticker?.(row),
  };

  const longPress = usePointerLongPress(() => setActionsOpen(true), {
    enabled: isTouch && hasActions,
  });

  const ariaLabel = [
    out ? "Tú" : contactName,
    formatChile(row.timestamp, "HH:mm"),
    row.body ?? fallbackLabel,
    out ? STATUS_LABEL[row.status] : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Touch: always-visible (subtle) kebab outside the bubble. Desktop: hover/
  // focus-revealed action menu (its own popover trigger).
  const trigger = hasActions ? (
    isTouch ? (
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label="Acciones del mensaje"
        onPress={() => setActionsOpen(true)}
        className={`absolute top-0 size-11 rounded-full text-default-500 opacity-70 ${
          out ? "right-full mr-0.5" : "left-full ml-0.5"
        }`}
      >
        <MoreVertical size={18} />
      </Button>
    ) : (
      <div
        className={`absolute top-1 flex opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 ${
          out ? "right-full mr-1" : "left-full ml-1"
        }`}
      >
        <MessageActionMenu api={api} />
      </div>
    )
  ) : null;

  return (
    <article
      aria-label={ariaLabel}
      className={`group relative flex ${wrapper} ${groupStart ? "mt-4" : "mt-0.5"}`}
      data-phi-block
      {...(isTouch && hasActions ? longPress.handlers : {})}
      onClickCapture={(e) => {
        if (longPress.didFire.current) {
          e.stopPropagation();
          e.preventDefault();
          longPress.didFire.current = false;
        }
      }}
    >
      <div
        className={`relative ${
          isSticker
            ? "max-w-[12rem]"
            : "w-fit min-w-[60px] max-w-[85%] sm:max-w-[75%] md:max-w-[min(75%,400px)]"
        }`}
      >
        {trigger}
        <div
          className={`${radius} ${
            isSticker ? "" : "w-fit min-w-[60px] max-w-full px-3 py-2 shadow-sm"
          } ${bubbleColor} ${out ? "ml-auto" : "mr-auto"} ${isPending ? "opacity-70" : ""}`}
        >
          <ForwardedBadge payload={row.payload as Record<string, unknown> | null} />
          {row.quotedSnippet && (
            <div
              className={`mb-1 rounded border-l-4 px-2 py-1 text-xs ${row.quotedSnippet.out ? "border-l-accent bg-accent/10 text-accent-foreground/80" : "border-l-default-400 bg-default-100/40 text-default-700"}`}
            >
              <p className="line-clamp-2">{row.quotedSnippet.body}</p>
            </div>
          )}
          {row.type === "LOCATION" ? (
            <LocationBubble payload={row.payload as Record<string, unknown> | null} />
          ) : row.type === "CONTACTS" ? (
            <ContactsBubble payload={row.payload as Record<string, unknown> | null} />
          ) : row.type === "INTERACTIVE" ? (
            <InteractiveBubble
              payload={row.payload as Record<string, unknown> | null}
              body={row.body}
            />
          ) : row.type === "TEMPLATE" && hasCarouselPayload(row.payload) ? (
            <CarouselPreview
              payload={row.payload as Record<string, unknown>}
              templateName={row.templateName}
            />
          ) : row.type === "UNSUPPORTED" ? (
            <UnsupportedBubble payload={row.payload as Record<string, unknown> | null} />
          ) : row.type === "TEMPLATE" ? (
            <div className="space-y-0.5">
              <span
                className={`flex items-center gap-1 text-[11px] ${out ? "text-success-foreground/70" : "text-default-400"}`}
              >
                <MessageSquareText size={12} className="shrink-0" />
                Plantilla
              </span>
              {row.templateName && (
                <p className="break-words text-sm leading-snug">{row.templateName}</p>
              )}
            </div>
          ) : isMedia && row.messageId ? (
            <MediaAttachment
              messageId={row.messageId}
              type={row.type}
              caption={row.body}
              out={out}
            />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-snug">
              {row.body ?? fallbackLabel}
            </p>
          )}
          {(groupEnd || failed) && (
            <div
              className={`flex items-center justify-end gap-1 text-xs ${
                isSticker
                  ? "mt-0.5 text-default-500"
                  : out
                    ? "mt-1 text-success-foreground/80"
                    : "mt-1 text-default-500"
              }`}
            >
              <span>{formatChile(row.timestamp, "HH:mm")}</span>
              {out && <StatusTicks status={row.status} />}
            </div>
          )}
          {failed && (
            <div className="mt-1 flex items-center justify-between gap-2 px-3 pb-1">
              <p className="text-danger text-xs">
                {row.errorTitle ?? "No se pudo enviar"}
                {row.errorDetails ? `: ${row.errorDetails}` : ""}
              </p>
              {canRetry && (
                <Button
                  size="sm"
                  variant="danger-soft"
                  onPress={() => onRetry?.(row)}
                  aria-label="Reintentar envío"
                  className="shrink-0"
                >
                  <RotateCw size={12} />
                  Reintentar
                </Button>
              )}
            </div>
          )}
        </div>
        {row.reactions && row.reactions.length > 0 && (
          <div
            className={`absolute -bottom-2.5 ${out ? "right-2" : "left-2"} flex items-center gap-0.5 rounded-full bg-content1 px-1.5 py-0.5 shadow-sm ring-1 ${ownReaction ? "ring-success" : "ring-default-200"}`}
          >
            {row.reactions.slice(0, 3).map((r, i) => (
              <span key={i} className="text-xs leading-none">
                {r.emoji}
              </span>
            ))}
            {row.reactions.length > 1 && (
              <span className="ml-0.5 text-default-500 text-xs">{row.reactions.length}</span>
            )}
          </div>
        )}
      </div>
      {isTouch && hasActions && (
        <MessageActionSheet open={actionsOpen} onOpenChange={setActionsOpen} api={api} />
      )}
    </article>
  );
}

// Detects whether an outbound TEMPLATE message carries a carousel payload
// (we persist the components array on send). Inbound payloads from Meta
// for templates also carry the same shape.
function hasCarouselPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const components = (payload as { components?: unknown }).components;
  if (!Array.isArray(components)) return false;
  return components.some(
    (c) => c && typeof c === "object" && (c as { type?: string }).type === "carousel"
  );
}

// Mini horizontal carousel preview for outbound TEMPLATE messages so the
// operator sees what cards were dispatched. Each card shows its image
// (via Meta media id, served by the wa-cloud media proxy) + body text.
function CarouselPreview({
  payload,
  templateName,
}: {
  payload: Record<string, unknown>;
  templateName?: string | null;
}) {
  type CardComp = {
    type?: string;
    text?: string;
    parameters?: Array<{
      type?: string;
      image?: { id?: string; link?: string };
      text?: string;
    }>;
  };
  type Card = { card_index?: number; components?: CardComp[] };
  const components = (payload.components ?? []) as Array<{ type?: string; cards?: Card[] }>;
  const carousel = components.find((c) => c.type === "carousel");
  const cards = carousel?.cards ?? [];

  return (
    <div className="space-y-1">
      <p className="text-success-foreground/80 text-xs">[carousel] {templateName ?? "plantilla"}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {cards.map((card, idx) => {
          const header = card.components?.find((c) => c.type === "header");
          const imgParam = header?.parameters?.find((p) => p.type === "image");
          const body = card.components?.find((c) => c.type === "body");
          const bodyText = body?.parameters?.[0]?.text ?? "";
          return (
            <div
              key={card.card_index ?? idx}
              className="w-40 shrink-0 rounded-lg bg-content1/80 text-foreground shadow-sm"
            >
              {imgParam?.image?.id ? (
                <div className="aspect-square w-full overflow-hidden rounded-t-lg bg-default-100">
                  <img
                    src={`/api/wa-cloud/media/by-meta-id/${imgParam.image.id}`}
                    alt={`carousel ${idx + 1}`}
                    className="size-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      // Fallback: hide broken image (Meta media ids expire 30d)
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="aspect-square w-full rounded-t-lg bg-default-100" />
              )}
              <div className="p-2">
                <p className="font-medium text-default-500 text-xs uppercase">
                  Tarjeta {(card.card_index ?? idx) + 1}
                </p>
                {bodyText && <p className="mt-0.5 line-clamp-3 text-xs leading-snug">{bodyText}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
