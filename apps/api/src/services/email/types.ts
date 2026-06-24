// Provider-agnostic email contract. The rest of the codebase talks to this
// interface only; concrete adapters (Resend today, AWS SES tomorrow) live
// behind it so swapping providers never touches a call site.

/** A single message to one recipient (or a small To: list). */
export interface EmailMessage {
  /** Recipient address(es). */
  to: string | string[];
  subject: string;
  /** HTML body. At least one of `html`/`text` must be present. */
  html?: string;
  /** Plain-text body / fallback. */
  text?: string;
  /** Override the configured sender (defaults to transactional `from`). */
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  /**
   * Extra MIME headers. Used for List-Unsubscribe (one-click) on broadcasts
   * and any custom tracking headers.
   */
  headers?: Record<string, string>;
  /**
   * Dedup key — the same key within the provider's window (Resend: 24h) is
   * sent at most once. Pattern: `<event>/<entityId>` e.g. `reset/123`.
   */
  idempotencyKey?: string;
  /**
   * File attachments. Base64 `content`. NOTE: not supported by the batch
   * endpoint (Resend limitation) — only single `send()`.
   */
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  /** Base64-encoded file content. */
  content: string;
  contentType?: string;
}

/** Outcome of a single send. `id` is the provider's message id when sent. */
export interface EmailSendResult {
  id: string | null;
  to: string[];
  ok: boolean;
  /** Present only when `ok === false` and the failure was non-throwing. */
  error?: string;
}

export interface EmailProvider {
  readonly name: string;
  /** Send one message. Throws DomainError on hard failure (auth, rate limit). */
  send(message: EmailMessage): Promise<EmailSendResult>;
  /**
   * Send up to `maxBatchSize` messages in one API round-trip. Each entry is a
   * distinct message/recipient. Returns one result per input, order-preserved.
   */
  sendBatch(messages: EmailMessage[]): Promise<EmailSendResult[]>;
  /** Hard cap on messages per `sendBatch` call (Resend: 100). */
  readonly maxBatchSize: number;
}
