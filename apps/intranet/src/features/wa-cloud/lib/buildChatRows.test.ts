import { describe, expect, it } from "vitest";
import { buildChatRows, firstUnreadKey, type RawMessage } from "./buildChatRows";

const T0 = new Date("2026-06-17T15:00:00-04:00");
const at = (offsetMin: number) => new Date(T0.getTime() + offsetMin * 60_000);

function msg(
  p: Partial<RawMessage> & { id: number; direction: "INBOUND" | "OUTBOUND" }
): RawMessage {
  return {
    body: "hola",
    type: "TEXT",
    timestamp: T0,
    status: "DELIVERED",
    metaMessageId: `wamid.${p.id}`,
    ...p,
  };
}

describe("buildChatRows — grouping", () => {
  it("collapses consecutive same-sender texts within 5 min", () => {
    const rows = buildChatRows(
      [
        msg({ id: 1, direction: "OUTBOUND", timestamp: at(0) }),
        msg({ id: 2, direction: "OUTBOUND", timestamp: at(1) }),
        msg({ id: 3, direction: "OUTBOUND", timestamp: at(2) }),
      ],
      []
    );
    const messages = rows.filter((r) => r.kind === "message");
    expect(messages).toHaveLength(3);
    // first starts the group but is not the end; last is the end
    expect(messages[0]).toMatchObject({ groupStart: true, groupEnd: false });
    expect(messages[1]).toMatchObject({ groupStart: false, groupEnd: false });
    expect(messages[2]).toMatchObject({ groupStart: false, groupEnd: true });
  });

  it("breaks the group when the sender changes", () => {
    const rows = buildChatRows(
      [
        msg({ id: 1, direction: "OUTBOUND", timestamp: at(0) }),
        msg({ id: 2, direction: "INBOUND", timestamp: at(1) }),
      ],
      []
    );
    const messages = rows.filter((r) => r.kind === "message");
    expect(messages[0]).toMatchObject({ groupStart: true, groupEnd: true });
    expect(messages[1]).toMatchObject({ groupStart: true, groupEnd: true });
  });

  it("breaks the group when the gap exceeds 5 minutes", () => {
    const rows = buildChatRows(
      [
        msg({ id: 1, direction: "OUTBOUND", timestamp: at(0) }),
        msg({ id: 2, direction: "OUTBOUND", timestamp: at(6) }),
      ],
      []
    );
    const messages = rows.filter((r) => r.kind === "message");
    expect(messages[0]).toMatchObject({ groupStart: true, groupEnd: true });
    expect(messages[1]).toMatchObject({ groupStart: true, groupEnd: true });
  });

  it("never groups media/standalone messages", () => {
    const rows = buildChatRows(
      [
        msg({ id: 1, direction: "OUTBOUND", timestamp: at(0) }),
        msg({ id: 2, direction: "OUTBOUND", type: "IMAGE", timestamp: at(1) }),
        msg({ id: 3, direction: "OUTBOUND", timestamp: at(2) }),
      ],
      []
    );
    const messages = rows.filter((r) => r.kind === "message");
    // image is standalone; the text before it ends its group, image is its own,
    // and the text after starts a fresh group.
    expect(messages.every((m) => m.groupStart && m.groupEnd)).toBe(true);
  });
});

describe("buildChatRows — reactions + quotes + pending", () => {
  it("folds REACTION messages onto their target instead of rendering rows", () => {
    const rows = buildChatRows(
      [
        msg({ id: 1, direction: "INBOUND", timestamp: at(0), metaMessageId: "wamid.target" }),
        msg({
          id: 2,
          direction: "OUTBOUND",
          type: "REACTION",
          body: "👍",
          timestamp: at(1),
          contextMetaMessageId: "wamid.target",
          metaMessageId: "wamid.rx",
        }),
      ],
      []
    );
    const messages = rows.filter((r) => r.kind === "message");
    expect(messages).toHaveLength(1);
    expect(messages[0]?.reactions).toEqual([{ emoji: "👍", out: true }]);
  });

  it("enriches the quoted snippet of a media reply with type + thumbnailMessageId", () => {
    const rows = buildChatRows(
      [
        msg({
          id: 10,
          direction: "INBOUND",
          type: "IMAGE",
          body: null,
          metaMessageId: "wamid.img",
        }),
        msg({
          id: 11,
          direction: "OUTBOUND",
          body: "linda foto",
          contextMetaMessageId: "wamid.img",
          metaMessageId: "wamid.reply",
        }),
      ],
      []
    );
    const reply = rows.filter((r) => r.kind === "message").find((r) => r.messageId === 11);
    expect(reply?.quotedSnippet).toMatchObject({
      type: "IMAGE",
      thumbnailMessageId: 10,
      body: "Imagen",
    });
  });

  it("does not set a thumbnail for a quoted text message", () => {
    const rows = buildChatRows(
      [
        msg({ id: 20, direction: "INBOUND", body: "hola", metaMessageId: "wamid.t" }),
        msg({
          id: 21,
          direction: "OUTBOUND",
          body: "responde",
          contextMetaMessageId: "wamid.t",
          metaMessageId: "wamid.r2",
        }),
      ],
      []
    );
    const reply = rows.filter((r) => r.kind === "message").find((r) => r.messageId === 21);
    expect(reply?.quotedSnippet?.type).toBe("TEXT");
    expect(reply?.quotedSnippet?.thumbnailMessageId).toBeUndefined();
  });

  it("appends optimistic pending sends after server messages", () => {
    const rows = buildChatRows(
      [msg({ id: 1, direction: "INBOUND", timestamp: at(0) })],
      [{ cid: "tmp-1", body: "enviando…", timestamp: at(1), status: "PENDING" }]
    );
    const messages = rows.filter((r) => r.kind === "message");
    expect(messages.at(-1)).toMatchObject({
      pendingCid: "tmp-1",
      out: true,
      status: "PENDING",
      messageId: null,
    });
  });
});

describe("firstUnreadKey", () => {
  it("returns the key of the Nth-from-end inbound message", () => {
    const rows = buildChatRows(
      [
        msg({ id: 1, direction: "INBOUND", timestamp: at(0) }),
        msg({ id: 2, direction: "OUTBOUND", timestamp: at(1) }),
        msg({ id: 3, direction: "INBOUND", timestamp: at(2) }),
        msg({ id: 4, direction: "INBOUND", timestamp: at(3) }),
      ],
      []
    );
    // 2 unread → first unread is the 1st of the last 2 inbound (id=3)
    expect(firstUnreadKey(rows, 2)).toBe("server-3");
  });

  it("returns null when nothing is unread", () => {
    const rows = buildChatRows([msg({ id: 1, direction: "INBOUND" })], []);
    expect(firstUnreadKey(rows, 0)).toBeNull();
  });
});
