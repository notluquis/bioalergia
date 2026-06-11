import { createHash } from "node:crypto";
import { sendEmail } from "./index.ts";
import type { EmailSendResult } from "./types.ts";

// Idempotency keys are sent as the Idempotency-Key header AND logged, so they
// must never contain credential material. Hash secrets one-way to keep
// per-credential dedupe without leaking the password/token.
function idemDigest(secret: string): string {
  return createHash("sha256").update(secret).digest("hex").slice(0, 16);
}

// Transactional email templates (reset, forgot-password link, honorarios PDF).
// Minimal inline HTML — no marketing chrome, no List-Unsubscribe (these are not
// marketing, recipients can't opt out of an account/security email).

function appUrl(): string {
  return (process.env.APP_URL || "https://intranet.bioalergia.cl").replace(/\/+$/, "");
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="es"><body style="font-family:system-ui,Arial,sans-serif;color:#1f2937;line-height:1.5;max-width:520px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;color:#0e64b7;margin:0 0 16px">${title}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
<p style="font-size:12px;color:#9ca3af">Bioalergia · Este es un correo automático, no respondas a esta dirección.</p>
</body></html>`;
}

/**
 * #1 — Admin reset: notify the user their password was reset and give them the
 * temporary password to log in and complete setup.
 */
export async function sendPasswordResetEmail(args: {
  to: string;
  name: string;
  tempPassword: string;
}): Promise<EmailSendResult> {
  const html = shell(
    "Tu acceso fue restablecido",
    `<p>Hola ${args.name},</p>
     <p>Un administrador restableció tu contraseña. Ingresa con esta contraseña temporal y completa la configuración de tu cuenta:</p>
     <p style="font-size:18px;font-weight:bold;background:#f3f4f6;padding:12px 16px;border-radius:8px;letter-spacing:1px">${args.tempPassword}</p>
     <p><a href="${appUrl()}/login" style="color:#0e64b7">Ir al inicio de sesión</a></p>
     <p style="font-size:13px;color:#6b7280">Por seguridad, se te pedirá definir una nueva contraseña al ingresar.</p>`
  );
  return sendEmail({
    to: args.to,
    subject: "Tu acceso a Bioalergia fue restablecido",
    html,
    text: `Hola ${args.name}, tu contraseña fue restablecida. Contraseña temporal: ${args.tempPassword}. Ingresa en ${appUrl()}/login y define una nueva.`,
    idempotencyKey: `pwreset/${args.to}/${idemDigest(args.tempPassword)}`,
  });
}

/**
 * #3 — Self-service forgot password: send a one-time reset link.
 */
export async function sendPasswordResetLinkEmail(args: {
  to: string;
  name: string;
  token: string;
}): Promise<EmailSendResult> {
  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(args.token)}`;
  const html = shell(
    "Restablece tu contraseña",
    `<p>Hola ${args.name},</p>
     <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón (válido por 1 hora):</p>
     <p><a href="${url}" style="display:inline-block;background:#0e64b7;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">Restablecer contraseña</a></p>
     <p style="font-size:13px;color:#6b7280">Si no fuiste tú, ignora este correo. Tu contraseña no cambiará.</p>`
  );
  return sendEmail({
    to: args.to,
    subject: "Restablece tu contraseña — Bioalergia",
    html,
    text: `Hola ${args.name}, restablece tu contraseña aquí (válido 1 hora): ${url}`,
    idempotencyKey: `pwlink/${idemDigest(args.token)}`,
  });
}

/**
 * #4 — Shop magic-link sign-in: one-time login link for bioalergia.cl.
 * The full URL is built by the caller (shop origin, not appUrl()).
 */
export async function sendMagicLinkEmail(args: {
  to: string;
  name: string;
  url: string;
}): Promise<EmailSendResult> {
  const html = shell(
    "Tu enlace de acceso",
    `<p>Hola ${args.name},</p>
     <p>Usa este botón para ingresar a tu cuenta de Bioalergia (válido por 15 minutos):</p>
     <p><a href="${args.url}" style="display:inline-block;background:#0e64b7;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">Ingresar a mi cuenta</a></p>
     <p style="font-size:13px;color:#6b7280">Si no solicitaste este acceso, ignora este correo.</p>`
  );
  return sendEmail({
    to: args.to,
    subject: "Tu enlace de acceso — Bioalergia",
    html,
    text: `Hola ${args.name}, ingresa a tu cuenta aquí (válido 15 minutos): ${args.url}`,
    idempotencyKey: `magiclink/${idemDigest(args.url)}`,
  });
}

/**
 * #2 — Honorarios: send the monthly summary email with the PDF attached.
 */
export async function sendTimesheetEmail(args: {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text: string;
  pdfBase64: string;
  pdfFilename: string;
}): Promise<EmailSendResult> {
  return sendEmail({
    to: args.to,
    from: args.from,
    subject: args.subject,
    html: args.html,
    text: args.text,
    attachments: [
      {
        filename: args.pdfFilename,
        content: args.pdfBase64,
        contentType: "application/pdf",
      },
    ],
    idempotencyKey: `honorarios/${args.to}/${args.subject}`,
  });
}
