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

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}

/**
 * #5 — Lead B2B de reactivos: avisa al equipo (interno, sin unsubscribe) que
 * llegó una solicitud desde la vitrina pública /venta-empresas. Los datos vienen
 * del formulario público → se escapan al renderizar el HTML.
 */
export async function sendReactivoLeadNotification(args: {
  to: string;
  lead: {
    id: number;
    empresa: string;
    contactName: string;
    email: string;
    phone: string | null;
    rut: string | null;
    message: string | null;
    productsOfInterest: string[];
  };
}): Promise<EmailSendResult> {
  const l = args.lead;
  const rows: Array<[string, string]> = [
    ["Empresa", l.empresa],
    ["Contacto", l.contactName],
    ["Email", l.email],
    ["Teléfono", l.phone || "—"],
    ["RUT", l.rut || "—"],
    ["Productos de interés", l.productsOfInterest.length ? l.productsOfInterest.join(", ") : "—"],
    ["Mensaje", l.message || "—"],
  ];
  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#6b7280;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 12px;font-weight:500">${esc(v)}</td></tr>`
    )
    .join("");
  const html = shell(
    "Nuevo lead de reactivos",
    `<p>Llegó una solicitud desde la vitrina de venta a empresas:</p>
     <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px">${tableRows}</table>
     <p style="margin-top:16px"><a href="${appUrl()}/settings/reactivos-leads" style="color:#0e64b7">Ver en la bandeja de leads</a></p>`
  );
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  return sendEmail({
    to: args.to,
    subject: `Nuevo lead de reactivos — ${l.empresa}`,
    html,
    text,
    idempotencyKey: `reactivolead/${l.id}`,
  });
}

function storeUrl(): string {
  return (process.env.STOREFRONT_BASE_URL || "https://bioalergia.cl").replace(/\/+$/, "");
}

function clp(n: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

// Prefer the opaque token (no email/PII in the URL); fall back to email for the
// rare case an order predates the token column.
function orderStatusLink(orderNumber: string, to: string, accessToken?: string | null): string {
  const base = `${storeUrl()}/pedido/${encodeURIComponent(orderNumber)}`;
  return accessToken
    ? `${base}?token=${encodeURIComponent(accessToken)}`
    : `${base}?email=${encodeURIComponent(to)}`;
}

/**
 * Shop order confirmation — sent to the buyer once MercadoPago approves the
 * payment (webhook). Order summary + DTE (boleta/factura) + a link to track the
 * order. Best-effort at the call site: a send failure must not break the webhook.
 */
export async function sendOrderConfirmationEmail(args: {
  to: string;
  orderNumber: string;
  totalClp: number;
  items: Array<{ name: string; qty: number; unitPriceClp: number }>;
  // Use the order's billing enum for the label — `dteType` from emitDte is the
  // SII code ("33" factura / "39" boleta), not "FACTURA"/"BOLETA".
  billingType?: "BOLETA" | "FACTURA";
  dteFolio?: string;
  dtePdfUrl?: string;
  accessToken?: string | null;
}): Promise<EmailSendResult> {
  const docLabel = args.billingType === "FACTURA" ? "Factura" : "Boleta";
  const statusUrl = orderStatusLink(args.orderNumber, args.to, args.accessToken);
  const itemRows = args.items
    .map(
      (it) =>
        `<tr><td style="padding:6px 12px">${esc(it.name)}</td><td style="padding:6px 12px;text-align:center">${it.qty}</td><td style="padding:6px 12px;text-align:right">${clp(it.unitPriceClp * it.qty)}</td></tr>`
    )
    .join("");
  const dteLine = args.dteFolio
    ? `<p style="margin-top:12px">${docLabel} electrónica N° ${esc(args.dteFolio)}${
        args.dtePdfUrl
          ? ` · <a href="${esc(args.dtePdfUrl)}" style="color:#0e64b7">Descargar</a>`
          : ""
      }</p>`
    : "";
  const html = shell(
    "¡Gracias por tu compra!",
    `<p>Confirmamos el pago de tu pedido <strong>${esc(args.orderNumber)}</strong>.</p>
     <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px;margin-top:12px">
       <thead><tr><th style="padding:6px 12px;text-align:left;color:#6b7280">Producto</th><th style="padding:6px 12px;color:#6b7280">Cant.</th><th style="padding:6px 12px;text-align:right;color:#6b7280">Total</th></tr></thead>
       <tbody>${itemRows}</tbody>
     </table>
     <p style="margin-top:12px;text-align:right;font-weight:600">Total: ${clp(args.totalClp)}</p>
     ${dteLine}
     <p style="margin-top:16px"><a href="${statusUrl}" style="color:#0e64b7">Ver el estado de tu pedido</a></p>`
  );
  const text = [
    `Confirmamos el pago de tu pedido ${args.orderNumber}.`,
    ...args.items.map((it) => `- ${it.qty}× ${it.name}: ${clp(it.unitPriceClp * it.qty)}`),
    `Total: ${clp(args.totalClp)}`,
    ...(args.dteFolio ? [`${docLabel} N° ${args.dteFolio}`] : []),
    `Estado: ${statusUrl}`,
  ].join("\n");
  return sendEmail({
    to: args.to,
    subject: `Confirmación de tu pedido ${args.orderNumber} — Bioalergia`,
    html,
    text,
    idempotencyKey: `order-confirmation/${args.orderNumber}`,
  });
}

/**
 * Shop order dispatched — sent when an admin marks the order FULFILLED. Lets the
 * buyer know it's on the way + a link to track. Best-effort at the call site.
 */
export async function sendOrderDispatchedEmail(args: {
  to: string;
  orderNumber: string;
  shippedToComuna?: string | null;
  accessToken?: string | null;
}): Promise<EmailSendResult> {
  const statusUrl = orderStatusLink(args.orderNumber, args.to, args.accessToken);
  const dest = args.shippedToComuna ? ` a ${esc(args.shippedToComuna)}` : "";
  const html = shell(
    "Tu pedido va en camino",
    `<p>Despachamos tu pedido <strong>${esc(args.orderNumber)}</strong>${dest}.</p>
     <p>Te llegará por Chilexpress en los próximos días hábiles según la cobertura de tu comuna.</p>
     <p style="margin-top:16px"><a href="${statusUrl}" style="color:#0e64b7">Ver el estado de tu pedido</a></p>`
  );
  const text =
    `Despachamos tu pedido ${args.orderNumber}${args.shippedToComuna ? ` a ${args.shippedToComuna}` : ""}.\n` +
    `Te llegará por Chilexpress en los próximos días hábiles.\nEstado: ${statusUrl}`;
  return sendEmail({
    to: args.to,
    subject: `Tu pedido ${args.orderNumber} fue despachado — Bioalergia`,
    html,
    text,
    idempotencyKey: `order-dispatched/${args.orderNumber}`,
  });
}

/**
 * Shop order refunded — sent when an admin refunds a paid order (money returned
 * to the buyer's MercadoPago payment method). Best-effort at the call site: a
 * send failure must not break the refund (the money is already back).
 */
export async function sendOrderRefundEmail(args: {
  to: string;
  orderNumber: string;
  totalClp: number;
  accessToken?: string | null;
}): Promise<EmailSendResult> {
  const statusUrl = orderStatusLink(args.orderNumber, args.to, args.accessToken);
  const html = shell(
    "Reembolsamos tu pedido",
    `<p>Reembolsamos tu pedido <strong>${esc(args.orderNumber)}</strong> por <strong>${clp(args.totalClp)}</strong> a tu medio de pago.</p>
     <p>El abono puede tardar unos días hábiles en reflejarse según tu banco o tarjeta.</p>
     <p style="margin-top:16px"><a href="${statusUrl}" style="color:#0e64b7">Ver el estado de tu pedido</a></p>`
  );
  const text =
    `Reembolsamos tu pedido ${args.orderNumber} por ${clp(args.totalClp)} a tu medio de pago.\n` +
    `El abono puede tardar unos días hábiles en reflejarse.\nEstado: ${statusUrl}`;
  return sendEmail({
    to: args.to,
    subject: `Reembolso de tu pedido ${args.orderNumber} — Bioalergia`,
    html,
    text,
    idempotencyKey: `order-refund/${args.orderNumber}`,
  });
}

/**
 * Shop order cancelled — sent when an admin cancels an unpaid (PENDING) order.
 * No money is involved (the order was never paid). Best-effort at the call site.
 */
export async function sendOrderCancelledEmail(args: {
  to: string;
  orderNumber: string;
  accessToken?: string | null;
}): Promise<EmailSendResult> {
  const statusUrl = orderStatusLink(args.orderNumber, args.to, args.accessToken);
  const html = shell(
    "Cancelamos tu pedido",
    `<p>Cancelamos tu pedido <strong>${esc(args.orderNumber)}</strong>.</p>
     <p>Si crees que se trata de un error o quieres retomar la compra, vuelve a hacer tu pedido en nuestra tienda.</p>
     <p style="margin-top:16px"><a href="${statusUrl}" style="color:#0e64b7">Ver el estado de tu pedido</a></p>`
  );
  const text =
    `Cancelamos tu pedido ${args.orderNumber}.\n` +
    `Si fue un error o quieres retomar la compra, vuelve a hacer tu pedido.\nEstado: ${statusUrl}`;
  return sendEmail({
    to: args.to,
    subject: `Tu pedido ${args.orderNumber} fue cancelado — Bioalergia`,
    html,
    text,
    idempotencyKey: `order-cancelled/${args.orderNumber}`,
  });
}

// Fecha legible es-CL para los avisos internos (plazos legales).
function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "long" }).format(d);
}

function notifyTable(rows: Array<[string, string]>): string {
  return rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;color:#6b7280;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 12px;font-weight:500">${esc(v)}</td></tr>`
    )
    .join("");
}

/**
 * #6 — Reclamo público (Decreto 35/2012): avisa al equipo que llegó un reclamo
 * desde el sitio. Interno (sin unsubscribe). Datos del formulario público → se
 * escapan al renderizar. El plazo legal de respuesta va destacado.
 */
export async function sendPublicComplaintNotification(args: {
  to: string;
  complaint: {
    id: string;
    complainantName: string;
    contact: string | null;
    category: string | null;
    description: string;
    dueAt: Date;
  };
}): Promise<EmailSendResult> {
  const c = args.complaint;
  const rows: Array<[string, string]> = [
    ["Nombre", c.complainantName],
    ["Contacto", c.contact || "—"],
    ["Categoría", c.category || "—"],
    ["Responder antes de", fmtDate(c.dueAt)],
    ["Reclamo", c.description],
  ];
  const html = shell(
    "Nuevo reclamo desde el sitio",
    `<p>Llegó un reclamo a través del formulario público (Decreto 35/2012). Plazo legal de respuesta: <strong>15 días hábiles</strong>.</p>
     <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px">${notifyTable(rows)}</table>
     <p style="margin-top:16px"><a href="${appUrl()}/admin/compliance?tab=reclamos" style="color:#0e64b7">Ver en la bandeja de reclamos</a></p>`
  );
  return sendEmail({
    to: args.to,
    subject: `Nuevo reclamo — ${c.complainantName}`,
    html,
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    idempotencyKey: `public-complaint/${c.id}`,
  });
}

/**
 * #7 — Ejercicio de derechos del titular (Ley 21.719): avisa al delegado que
 * llegó una solicitud (acceso/rectificación/etc.). Incluye el tipo y el plazo
 * de 30 días corridos. El equipo debe verificar identidad antes de responder.
 */
export async function sendPublicDataRightsNotification(args: {
  to: string;
  request: {
    id: string;
    type: string;
    requesterName: string;
    requesterEmail: string | null;
    requesterRut: string | null;
    dueAt: Date;
    notes: string | null;
  };
}): Promise<EmailSendResult> {
  const r = args.request;
  const typeLabels: Record<string, string> = {
    ACCESS: "Acceso",
    RECTIFICATION: "Rectificación",
    DELETION: "Supresión",
    PORTABILITY: "Portabilidad",
    OPPOSITION: "Oposición",
    BLOCKING: "Bloqueo",
  };
  const rows: Array<[string, string]> = [
    ["Derecho ejercido", typeLabels[r.type] ?? r.type],
    ["Solicitante", r.requesterName],
    ["Email", r.requesterEmail || "—"],
    ["RUT", r.requesterRut || "—"],
    ["Responder antes de", fmtDate(r.dueAt)],
    ["Detalle", r.notes || "—"],
  ];
  const html = shell(
    "Nueva solicitud de derechos del titular",
    `<p>Llegó una solicitud de derechos del titular (Ley 21.719) desde el sitio. <strong>Verifica la identidad del solicitante</strong> antes de responder. Plazo: 30 días corridos (prorrogable una vez).</p>
     <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px">${notifyTable(rows)}</table>
     <p style="margin-top:16px"><a href="${appUrl()}/admin/compliance?tab=derechos" style="color:#0e64b7">Ver en la bandeja de derechos</a></p>`
  );
  return sendEmail({
    to: args.to,
    subject: `Solicitud de derechos (${typeLabels[r.type] ?? r.type}) — ${r.requesterName}`,
    html,
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    idempotencyKey: `public-datarights/${r.id}`,
  });
}

/**
 * #8 — Contacto general: reenvía el mensaje del formulario público al equipo. No
 * se persiste (minimización Ley 21.719); este correo ES el registro. Reply-To
 * apunta al remitente para responder directo.
 */
export async function sendPublicContactNotification(args: {
  to: string;
  contact: { name: string; email: string; phone: string | null; message: string };
}): Promise<EmailSendResult> {
  const c = args.contact;
  const rows: Array<[string, string]> = [
    ["Nombre", c.name],
    ["Email", c.email],
    ["Teléfono", c.phone || "—"],
    ["Mensaje", c.message],
  ];
  const html = shell(
    "Nuevo mensaje de contacto",
    `<p>Llegó un mensaje desde el formulario de contacto del sitio:</p>
     <table style="border-collapse:collapse;width:100%;background:#f9fafb;border-radius:8px">${notifyTable(rows)}</table>`
  );
  return sendEmail({
    to: args.to,
    replyTo: c.email,
    subject: `Contacto web — ${c.name}`,
    html,
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
  });
}

/**
 * Canal Ley Karin (Ley 21.643): avisa al receptor designado que llegó una
 * denuncia de acoso/violencia laboral. Interno y CONFIDENCIAL: va sólo al buzón
 * restringido (denuncias@bioalergia.cl); el detalle queda en la bandeja con
 * acceso restringido, el correo es sólo el aviso + plazos legales. Best-effort.
 */
export async function sendKarinReportNotification(args: {
  to: string;
  report: {
    id: string;
    reportType: string;
    reporterName: string;
    reportedPerson: string | null;
    resguardoDueAt: Date;
    remitirDueAt: Date;
    investigationDueAt: Date;
  };
}): Promise<EmailSendResult> {
  const r = args.report;
  const typeLabels: Record<string, string> = {
    ACOSO_LABORAL: "Acoso laboral",
    ACOSO_SEXUAL: "Acoso sexual",
    VIOLENCIA: "Violencia en el trabajo",
  };
  const rows: Array<[string, string]> = [
    ["Tipo", typeLabels[r.reportType] ?? r.reportType],
    ["Denunciante", r.reporterName],
    ["Persona denunciada", r.reportedPerson || "—"],
    ["Resguardo inmediato", fmtDate(r.resguardoDueAt)],
    ["Remitir a Inspección del Trabajo", fmtDate(r.remitirDueAt)],
    ["Cierre de investigación", fmtDate(r.investigationDueAt)],
  ];
  const html = shell(
    "Nueva denuncia Ley Karin",
    `<p>Llegó una denuncia por el canal Ley Karin (Ley 21.643). <strong>Confidencial y de acceso restringido.</strong> Adopta de inmediato las medidas de resguardo y revisa los plazos legales.</p>
     <table style="border-collapse:collapse;width:100%;background:#fef2f2;border-radius:8px">${notifyTable(rows)}</table>
     <p style="margin-top:16px"><a href="${appUrl()}/admin/compliance?tab=karin" style="color:#0e64b7">Ver en la bandeja Karin</a></p>`
  );
  return sendEmail({
    to: args.to,
    subject: `Denuncia Ley Karin — ${typeLabels[r.reportType] ?? r.reportType}`,
    html,
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    idempotencyKey: `karin-report/${r.id}`,
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
