import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createSecureServer } from "node:http2";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import type SMTPConnection from "nodemailer/lib/smtp-connection";
import type SMTPPool from "nodemailer/lib/smtp-pool";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type StreamTransport from "nodemailer/lib/stream-transport";
import { z } from "zod";
import { readKeychainSecret } from "./keychain";

const SERVICE_NAME = "bioalergia-local-mail-agent";
const SMTP_HOST = "mail.spacemail.com";
const SMTP_PORT = 465;
const SMTP_SECURE = true;
const IMAP_HOST = process.env.LOCAL_AGENT_IMAP_HOST ?? "mail.spacemail.com";
const IMAP_PORT = Number.parseInt(process.env.LOCAL_AGENT_IMAP_PORT ?? "993", 10);
const IMAP_SECURE = process.env.LOCAL_AGENT_IMAP_SECURE !== "0";
const IMAP_SENT_MAILBOX = process.env.LOCAL_AGENT_IMAP_SENT_MAILBOX;
const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024;
const DEFAULT_PORT = 3333;
const DEFAULT_ALLOWED_ORIGINS = ["https://intranet.bioalergia.cl", "http://localhost"];
const TLS_KEY_PATH = process.env.LOCAL_AGENT_TLS_KEY_PATH;
const TLS_CERT_PATH = process.env.LOCAL_AGENT_TLS_CERT_PATH;
const BASE64_PATTERN = /^[A-Za-z0-9+/=]+$/;
const SMTP_POOL = process.env.LOCAL_AGENT_SMTP_POOL === "1";
const SMTP_DEBUG = process.env.LOCAL_AGENT_SMTP_DEBUG === "1";
const SMTP_MAX_CONNECTIONS = Number.parseInt(
  process.env.LOCAL_AGENT_SMTP_MAX_CONNECTIONS ?? "2",
  10,
);
const SMTP_MAX_MESSAGES = Number.parseInt(process.env.LOCAL_AGENT_SMTP_MAX_MESSAGES ?? "50", 10);
const DSN_ENABLED = process.env.LOCAL_AGENT_DSN_ENABLED === "1";
const DSN_NOTIFY: SMTPConnection.DSNOption[] = ["FAILURE", "DELAY"];
let cachedTransporter: Awaited<ReturnType<typeof createTransport>> | null = null;
let cachedTransportUser: null | string = null;

const AttachmentSchema = z.object({
  filename: z.string().min(1),
  contentBase64: z.string().min(1),
  contentType: z.string().min(1),
});

const EmailPayloadSchema = z.object({
  to: z.string().email(),
  from: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
  attachments: z.array(AttachmentSchema).min(1),
});

function getAllowedOrigins() {
  const envOrigins = process.env.LOCAL_AGENT_ALLOWED_ORIGINS;
  if (!envOrigins) {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  return envOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function sanitizeBase64(input: string) {
  return input.replace(/\s+/g, "");
}

function estimateBase64Bytes(base64: string) {
  const clean = sanitizeBase64(base64);
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

function isLikelyBase64(base64: string) {
  const clean = sanitizeBase64(base64);
  if (clean.length === 0 || clean.length % 4 !== 0) {
    return false;
  }
  return BASE64_PATTERN.test(clean);
}

function formatSmtpError(error: unknown) {
  if (error && typeof error === "object") {
    const maybeError = error as {
      code?: string;
      command?: string;
      message?: string;
      responseCode?: number;
    };
    return {
      code: maybeError.code ?? "UNKNOWN",
      command: maybeError.command ?? "UNKNOWN",
      message: maybeError.message ?? "SMTP error",
      responseCode: maybeError.responseCode ?? null,
    };
  }
  return {
    code: "UNKNOWN",
    command: "UNKNOWN",
    message: "SMTP error",
    responseCode: null,
  };
}

function formatImapError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "IMAP append error";
}

async function loadSecrets() {
  const [smtpUser, smtpPass, agentToken] = await Promise.all([
    readKeychainSecret(SERVICE_NAME, "smtp_user"),
    readKeychainSecret(SERVICE_NAME, "smtp_pass"),
    readKeychainSecret(SERVICE_NAME, "agent_token"),
  ]);
  return { smtpUser, smtpPass, agentToken };
}

async function createTransport(smtpUser: string, smtpPass: string) {
  if (SMTP_POOL) {
    const poolOptions: SMTPPool.Options = {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      pool: true,
      maxConnections: SMTP_MAX_CONNECTIONS,
      maxMessages: SMTP_MAX_MESSAGES,
      debug: SMTP_DEBUG,
      logger: SMTP_DEBUG,
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 60_000,
      disableFileAccess: true,
      disableUrlAccess: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    };
    return nodemailer.createTransport(poolOptions);
  }

  const smtpOptions: SMTPTransport.Options = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    debug: SMTP_DEBUG,
    logger: SMTP_DEBUG,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
    disableFileAccess: true,
    disableUrlAccess: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  };
  return nodemailer.createTransport(smtpOptions);
}

async function getTransporter(smtpUser: string, smtpPass: string) {
  if (cachedTransporter && cachedTransportUser === smtpUser) {
    return cachedTransporter;
  }

  cachedTransporter = await createTransport(smtpUser, smtpPass);
  cachedTransportUser = smtpUser;
  return cachedTransporter;
}

async function buildRawRfc822Message(mailOptions: Mail.Options) {
  const streamTransport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "windows",
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const info = (await streamTransport.sendMail(mailOptions)) as StreamTransport.SentMessageInfo;
  return info.message.toString("utf-8");
}

async function resolveSentMailboxPath(client: ImapFlow) {
  if (IMAP_SENT_MAILBOX) {
    return IMAP_SENT_MAILBOX;
  }

  const boxes = await client.list();
  const sentByFlag = boxes.find(
    (box) => box.specialUse === "\\Sent" || box.specialUse?.toUpperCase() === "SENT",
  );
  if (sentByFlag?.path) {
    return sentByFlag.path;
  }

  const sentByName = boxes.find((box) => box.path.toLowerCase().includes("sent"));
  if (sentByName?.path) {
    return sentByName.path;
  }

  return "Sent";
}

async function appendToSentMailbox({
  rawMessage,
  smtpPass,
  smtpUser,
}: {
  rawMessage: string;
  smtpPass: string;
  smtpUser: string;
}) {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_SECURE,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await client.connect();
  try {
    const sentPath = await resolveSentMailboxPath(client);
    await client.append(sentPath, rawMessage, ["\\Seen"], new Date());
    return { saved: true, sentPath };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

const app = new Hono();

app.use(
  "*",
  cors({
    origin: getAllowedOrigins(),
    allowHeaders: ["Content-Type", "X-Local-Agent-Token", "Access-Control-Request-Private-Network"],
    allowMethods: ["POST", "GET", "OPTIONS"],
  }),
);

app.use("*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Private-Network", "true");
});

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/health/config", (c) => {
  return c.json({
    status: "ok",
    config: {
      smtp: {
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        pool: SMTP_POOL,
        maxConnections: SMTP_POOL ? SMTP_MAX_CONNECTIONS : null,
        maxMessages: SMTP_POOL ? SMTP_MAX_MESSAGES : null,
        debug: SMTP_DEBUG,
        disableFileAccess: true,
        disableUrlAccess: true,
        dsnEnabled: DSN_ENABLED,
        dsnNotify: DSN_ENABLED ? DSN_NOTIFY : [],
      },
      tls: {
        enabled: Boolean(TLS_KEY_PATH && TLS_CERT_PATH),
      },
      allowedOrigins: getAllowedOrigins(),
    },
  });
});

app.get("/health/smtp", async (c) => {
  let secrets: Awaited<ReturnType<typeof loadSecrets>>;
  try {
    secrets = await loadSecrets();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Keychain error";
    return c.json({ status: "error", message }, 500);
  }

  const token = c.req.header("X-Local-Agent-Token");
  if (!token || token !== secrets.agentToken) {
    return c.json({ status: "error", message: "Unauthorized" }, 401);
  }

  try {
    const transporter = await getTransporter(secrets.smtpUser, secrets.smtpPass);
    await transporter.verify();
    return c.json({ status: "ok", smtp: "ready" });
  } catch (error) {
    const smtpError = formatSmtpError(error);
    console.error("[mail-agent] SMTP verify failed:", smtpError);
    return c.json({ status: "error", message: smtpError.message, code: smtpError.code }, 502);
  }
});

app.post("/send", async (c) => {
  let secrets: Awaited<ReturnType<typeof loadSecrets>>;
  try {
    secrets = await loadSecrets();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Keychain error";
    return c.json({ status: "error", message }, 500);
  }

  const token = c.req.header("X-Local-Agent-Token");
  if (!token || token !== secrets.agentToken) {
    return c.json({ status: "error", message: "Unauthorized" }, 401);
  }

  let payload: z.infer<typeof EmailPayloadSchema>;
  try {
    payload = EmailPayloadSchema.parse(await c.req.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payload inválido";
    return c.json({ status: "error", message }, 400);
  }

  let totalBytes = 0;
  for (const attachment of payload.attachments) {
    if (!isLikelyBase64(attachment.contentBase64)) {
      return c.json({ status: "error", message: "Adjunto base64 inválido" }, 400);
    }
    totalBytes += estimateBase64Bytes(attachment.contentBase64);
  }

  if (totalBytes > MAX_ATTACHMENT_BYTES) {
    return c.json({ status: "error", message: "Adjunto supera 30 MB" }, 413);
  }

  const attachments = payload.attachments.map((attachment) => ({
    filename: attachment.filename,
    content: sanitizeBase64(attachment.contentBase64),
    encoding: "base64" as const,
    contentType: attachment.contentType,
  }));

  try {
    const transporter = await getTransporter(secrets.smtpUser, secrets.smtpPass);
    const dsn: SMTPConnection.DSNOptions | undefined = DSN_ENABLED
      ? {
          envid: randomUUID(),
          notify: DSN_NOTIFY,
          orcpt: secrets.smtpUser,
          ret: "HDRS",
        }
      : undefined;
    const messageId = `<${randomUUID()}@bioalergia.cl>`;
    const messageDate = new Date();
    const mailOptions: Mail.Options & { dsn?: SMTPConnection.DSNOptions } = {
      from: secrets.smtpUser,
      to: payload.to,
      messageId,
      date: messageDate,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      attachments,
      dsn,
    };

    const rawMessage = await buildRawRfc822Message(mailOptions);
    const info = await transporter.sendMail(mailOptions);

    let sentFolderSaved = true;
    let sentFolderPath: null | string = null;
    try {
      const appendResult = await appendToSentMailbox({
        rawMessage,
        smtpPass: secrets.smtpPass,
        smtpUser: secrets.smtpUser,
      });
      sentFolderSaved = appendResult.saved;
      sentFolderPath = appendResult.sentPath;
    } catch (error) {
      sentFolderSaved = false;
      console.error("[mail-agent] IMAP append to Sent failed:", formatImapError(error));
    }

    console.log(
      `[mail-agent] Sent email to ${payload.to} (subject: ${payload.subject}) id=${info.messageId}`,
    );
    if (sentFolderSaved && sentFolderPath) {
      console.log(`[mail-agent] Saved sent copy in mailbox: ${sentFolderPath}`);
    }
    return c.json({ status: "ok", sentFolderSaved, sentFolderPath });
  } catch (error) {
    const smtpError = formatSmtpError(error);
    console.error("[mail-agent] SMTP send failed:", smtpError);
    return c.json({ status: "error", message: smtpError.message, code: smtpError.code }, 502);
  }
});

const port = Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
const hostname = "127.0.0.1";

async function closeTransporter() {
  if (!cachedTransporter) {
    return;
  }
  try {
    cachedTransporter.close();
  } catch {
    // noop
  } finally {
    cachedTransporter = null;
    cachedTransportUser = null;
  }
}

process.on("SIGINT", () => {
  void closeTransporter().finally(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void closeTransporter().finally(() => process.exit(0));
});

if (TLS_KEY_PATH && TLS_CERT_PATH) {
  const key = readFileSync(TLS_KEY_PATH);
  const cert = readFileSync(TLS_CERT_PATH);
  serve(
    {
      fetch: app.fetch,
      port,
      hostname,
      createServer: createSecureServer,
      serverOptions: { key, cert },
    },
    (info) => {
      console.log(`Local mail agent listening on https://${info.address}:${info.port}`);
    },
  );
} else {
  serve({ fetch: app.fetch, port, hostname }, (info) => {
    console.log(`Local mail agent listening on http://${info.address}:${info.port}`);
  });
}
