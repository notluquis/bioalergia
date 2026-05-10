import { Button, Popover } from "@heroui/react";
import dayjs from "dayjs";
import { CornerUpLeft, Pencil, Smile } from "lucide-react";
import { MediaAttachment } from "./MediaAttachment";
import {
  ContactsBubble,
  ForwardedBadge,
  InteractiveBubble,
  LocationBubble,
  UnsupportedBubble,
} from "./SpecialMessage";
import { type MessageStatus, QUICK_REACTIONS, StatusTicks } from "./_shared";

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
};

export function ChatBubble({
  row,
  onReply,
  onReact,
  onEdit,
}: {
  row: ChatBubbleRow;
  onReply: (row: {
    metaMessageId: string | null;
    body: string | null;
    type: string;
    out: boolean;
  }) => void;
  onReact: (row: { metaMessageId: string | null; out: boolean }, emoji: string) => void;
  onEdit: (row: { messageId: number | null; body: string | null }) => void;
}) {
  const out = row.out;
  const isPending = row.status === "PENDING";
  const failed = row.status === "FAILED";
  const wrapper = out ? "justify-end" : "justify-start";
  const canInteract = row.metaMessageId !== null;
  // 100% HeroUI semantic tokens. Outbound uses success (clinic green),
  // inbound uses content1 (raised surface), failed uses danger.
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

  const actions = canInteract ? (
    <div
      className={`absolute top-1 ${out ? "right-full mr-1" : "left-full ml-1"} flex gap-1 opacity-0 transition pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto`}
    >
      <Popover>
        <Popover.Trigger>
          <Button size="sm" variant="outline" isIconOnly aria-label="Reaccionar">
            <Smile size={14} />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="rounded-full border border-default-200 bg-content1 px-1 py-1 shadow-md">
          <Popover.Dialog className="flex gap-0.5 p-0">
            {QUICK_REACTIONS.map((e) => (
              <Button
                key={e}
                size="sm"
                variant="outline"
                isIconOnly
                aria-label={`Reaccionar ${e}`}
                onPress={() => onReact({ metaMessageId: row.metaMessageId, out }, e)}
                className="rounded-full border-0 text-lg"
              >
                {e}
              </Button>
            ))}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      <Button
        size="sm"
        variant="outline"
        isIconOnly
        aria-label="Responder"
        onPress={() =>
          onReply({
            metaMessageId: row.metaMessageId,
            body: row.body,
            type: row.type,
            out,
          })
        }
      >
        <CornerUpLeft size={14} />
      </Button>
      {out &&
        row.type === "TEXT" &&
        row.messageId !== null &&
        Date.now() - row.timestamp.getTime() < 15 * 60 * 1000 && (
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            aria-label="Editar"
            onPress={() => onEdit({ messageId: row.messageId, body: row.body })}
          >
            <Pencil size={14} />
          </Button>
        )}
    </div>
  ) : null;

  return (
    <div className={`group relative flex ${wrapper}`}>
      <div
        className={`relative ${
          isSticker ? "max-w-[12rem]" : "w-fit max-w-[78%] min-w-[60px] lg:max-w-[480px]"
        }`}
      >
        {actions}
        <div
          className={`${radius} ${isSticker ? "" : "w-fit min-w-[60px] max-w-full px-3 py-2 shadow-sm"} ${bubbleColor} ${
            out ? "ml-auto" : "mr-auto"
          } ${isPending ? "opacity-70" : ""}`}
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
          ) : row.type === "UNSUPPORTED" ? (
            <UnsupportedBubble payload={row.payload as Record<string, unknown> | null} />
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
          <div
            className={`flex items-center justify-end gap-1 text-[10px] ${
              isSticker
                ? "mt-0.5 text-default-500"
                : out
                  ? "mt-1 text-success-foreground/80"
                  : "mt-1 text-default-500"
            }`}
          >
            <span>{dayjs(row.timestamp).format("HH:mm")}</span>
            {out && <StatusTicks status={row.status} />}
          </div>
          {failed && row.errorTitle && (
            <p className="mt-1 px-3 pb-1 text-[11px] text-danger">
              {row.errorTitle}
              {row.errorDetails ? `: ${row.errorDetails}` : ""}
            </p>
          )}
        </div>
        {row.reactions && row.reactions.length > 0 && (
          <div
            className={`absolute -bottom-2.5 ${out ? "right-2" : "left-2"} flex items-center gap-0.5 rounded-full bg-content1 px-1.5 py-0.5 shadow-sm ring-1 ring-default-200`}
          >
            {row.reactions.slice(0, 3).map((r, i) => (
              <span key={i} className="text-xs leading-none">
                {r.emoji}
              </span>
            ))}
            {row.reactions.length > 1 && (
              <span className="ml-0.5 text-[10px] text-default-500">{row.reactions.length}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
