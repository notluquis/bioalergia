// WhatsApp Cloud template: confirmación de hora + recordatorio de pago para
// consulta de alergología en Bioalergia (pago día anterior).
//
// ── Tono y guidelines aplicadas ─────────────────────────────────────────────
//
// 1. CHILE clínica profesional → registro USTED.
//    Chile usa "usted" más que cualquier otro país hispano, incluso en
//    contextos semi-informales y con público joven. Para consulta médica
//    con paciente desconocido = usted por defecto (Common Ground Medical
//    Spanish + Certified Spanish 2024: "must always use Usted with adult
//    patients unless invited to use Tú"). Cambiar a "tú" solo si el doctor
//    lo autoriza explícitamente para campañas dirigidas a pacientes que
//    ya tienen relación previa de confianza.
//
// 2. ANTI-CONFRONTACIÓN (Tebra · MGMA · Weave · BillFlash 2026):
//    - Framing "reservar / asegurar su hora" (no "abono", no "obligatorio")
//    - "Le pedimos por favor" en vez de "es necesario" (Common Ground:
//      include "por favor" para suavizar comandos)
//    - WHY explícito: "organizar agenda + reservar cupo con tranquilidad"
//      (no arbitrariedad)
//    - Escape valve sin penalty: "si necesita reagendar, avísenos con
//      anticipación y coordinamos sin problema" → reduce loss aversion
//      anticipada del paciente (vs. tono que retiene su dinero si cancela)
//    - Drop threat: NO "podrá ser otorgada a otro paciente" (Weave:
//      "avoid scaring patients") → reemplazado por beneficio mutuo
//
// 3. BEHAVIORAL ECONOMICS:
//    - El acto de pagar ES el commitment device. No requiere amenaza
//      adicional (Curogram + Outsource Receivables 2026).
//    - Loss aversion se canaliza sutilmente vía gain framing positivo
//      ("asegurar su hora"), no via threat.
//    - Empatía + reciprocidad ("entendemos que pueden surgir imprevistos")
//      activa norma de reciprocidad social.
//
// 4. META UTILITY 2026 (compliance):
//    - Categoría UTILITY estricta (transaccional, sin opt-in requerido).
//    - SIN mixing marketing/utility (rechazo automático post-2024 Meta
//      classifier update). Este texto es 100% transaccional: confirmación
//      de cita + instrucciones de pago para transacción ya acordada.
//    - URL Mercado Pago es link de pago transaccional (Meta lo permite
//      explícitamente para "consultation fees, deposit, procedure
//      charges" en healthcare templates).
//    - 1 variable solamente ({{1}}=fecha y hora) → menor superficie de
//      rechazo (sample value claro).
//    - ~720 chars body (límite 1024).
//
// ── Registro en Meta Business Manager ───────────────────────────────────────
//
//   Templates → New Template:
//   - Name:     appointment_payment_request
//   - Category: UTILITY
//   - Language: Spanish (es)
//   - Header:   (vacío)
//   - Body:     `TEMPLATE_BODY` literal
//   - Body Variables: {{1}} sample value = "viernes 23 de mayo, 10:30"
//   - Footer:   (opcional) "Bioalergia · Concepción"
//   - Buttons:  (vacío)
//
// Formato WhatsApp markdown: *texto* = negrita. Meta acepta en body.

import { sendTemplateMessage } from "../graph-client.ts";

export const APPOINTMENT_PAYMENT_TEMPLATE_NAME = "appointment_payment_request";
export const APPOINTMENT_PAYMENT_TEMPLATE_LANGUAGE = "es";

// Texto exacto a registrar en Meta Business Manager.
// {{1}} = fecha y hora del appointment ya formateada para el paciente.
export const TEMPLATE_BODY = `*Bioalergia · Consulta con el Dr. José Manuel Martínez*

¡Hola! Le confirmamos su reserva tomada por Doctoralia:

*Fecha y hora:* {{1}}
*Valor de la consulta:* $60.000

Para asegurar su hora, le pedimos por favor realizar el pago el día anterior a la consulta. Esto nos permite organizar la agenda y reservar su cupo con tranquilidad.

Entendemos que pueden surgir imprevistos — si necesita reagendar, avísenos con anticipación y coordinamos una nueva hora sin problema.

*Formas de pago*
• Link Mercado Pago: http://link.mercadopago.cl/bioalergia
• Transferencia bancaria:
  *Titular:* Dr. José Manuel Martínez y Compañía Limitada
  *RUT:* 76.406.172-1
  *Banco:* Mercado Pago
  *Tipo:* Cuenta Vista
  *N°:* 1076536761
  *Correo:* finanzas@bioalergia.cl

Cuando tenga el comprobante, envíenoslo por este mismo chat para confirmar su hora.

Quedamos atentos a cualquier consulta. ¡Le esperamos!`;

export async function sendAppointmentPaymentRequest(args: {
  phoneNumberId: number;
  toE164: string;
  /** Fecha y hora ya formateada para mostrar al paciente, ej. "viernes 23 de mayo, 10:30". */
  appointmentDate: string;
}) {
  return await sendTemplateMessage({
    phoneNumberId: args.phoneNumberId,
    toE164: args.toE164,
    templateName: APPOINTMENT_PAYMENT_TEMPLATE_NAME,
    language: APPOINTMENT_PAYMENT_TEMPLATE_LANGUAGE,
    components: [
      {
        type: "body",
        parameters: [{ type: "text", text: args.appointmentDate }],
      },
    ],
  });
}
