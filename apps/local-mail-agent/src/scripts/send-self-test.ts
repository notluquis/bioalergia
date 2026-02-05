import nodemailer from "nodemailer";
import { readKeychainSecret } from "../keychain";

const SERVICE_NAME = "bioalergia-local-mail-agent";
const SMTP_HOST = "mail.spacemail.com";
const SMTP_PORT = 465;
const SMTP_SECURE = true;

async function main() {
  const smtpUser = await readKeychainSecret(SERVICE_NAME, "smtp_user");
  const smtpPass = await readKeychainSecret(SERVICE_NAME, "smtp_pass");

  const transporter = nodemailer.createTransport({
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

  await transporter.verify();

  const timestamp = new Date().toISOString();
  const info = await transporter.sendMail({
    from: smtpUser,
    to: smtpUser,
    subject: `[local-mail-agent] Self test ${timestamp}`,
    text: `SMTP self-test executed at ${timestamp}`,
    html: `<p>SMTP self-test executed at <strong>${timestamp}</strong></p>`,
  });

  console.log(`[mail-agent:test] Sent self-test email to ${smtpUser}`);
  console.log(`[mail-agent:test] messageId=${info.messageId}`);
}

main().catch((error: unknown) => {
  if (error && typeof error === "object") {
    const maybeError = error as {
      code?: string;
      command?: string;
      message?: string;
      responseCode?: number;
    };
    console.error("[mail-agent:test] Failed:", {
      code: maybeError.code ?? "UNKNOWN",
      command: maybeError.command ?? "UNKNOWN",
      message: maybeError.message ?? "SMTP error",
      responseCode: maybeError.responseCode ?? null,
    });
  } else {
    console.error("[mail-agent:test] Failed: SMTP error");
  }
  process.exit(1);
});
