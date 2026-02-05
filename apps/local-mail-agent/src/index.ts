import { readFileSync } from "node:fs";
import { createSecureServer } from "node:http2";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import nodemailer from "nodemailer";
import { z } from "zod";
import { readKeychainSecret } from "./keychain";

const SERVICE_NAME = "bioalergia-local-mail-agent";
const SMTP_HOST = "mail.spacemail.com";
const SMTP_PORT = 465;
const SMTP_SECURE = true;
const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024;
const DEFAULT_PORT = 3333;
const DEFAULT_ALLOWED_ORIGINS = ["https://intranet.bioalergia.cl", "http://localhost"];
const TLS_KEY_PATH = process.env.LOCAL_AGENT_TLS_KEY_PATH;
const TLS_CERT_PATH = process.env.LOCAL_AGENT_TLS_CERT_PATH;
const BASE64_PATTERN = /^[A-Za-z0-9+/=]+$/;

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

async function loadSecrets() {
  const [smtpUser, smtpPass, agentToken] = await Promise.all([
    readKeychainSecret(SERVICE_NAME, "smtp_user"),
    readKeychainSecret(SERVICE_NAME, "smtp_pass"),
    readKeychainSecret(SERVICE_NAME, "agent_token"),
  ]);
  return { smtpUser, smtpPass, agentToken };
}

async function createTransport(smtpUser: string, smtpPass: string) {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
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
    const transporter = await createTransport(secrets.smtpUser, secrets.smtpPass);
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
    const transporter = await createTransport(secrets.smtpUser, secrets.smtpPass);
    const info = await transporter.sendMail({
      from: secrets.smtpUser,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      attachments,
    });
    console.log(
      `[mail-agent] Sent email to ${payload.to} (subject: ${payload.subject}) id=${info.messageId}`,
    );
    return c.json({ status: "ok" });
  } catch (error) {
    const smtpError = formatSmtpError(error);
    console.error("[mail-agent] SMTP send failed:", smtpError);
    return c.json({ status: "error", message: smtpError.message, code: smtpError.code }, 502);
  }
});

const port = Number.parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
const hostname = "127.0.0.1";

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
