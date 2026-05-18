// WhatsApp Cloud template: solicitud de abono previo del 50% para confirmar
// la hora de consulta de alergología en Bioalergia.
//
// Estado: TEMPLATE PENDIENTE DE APROBACIÓN POR META. Texto debajo
// (`TEMPLATE_BODY`) corresponde literal al que hay que pegar en
// WhatsApp Business Manager → Templates → New Template:
//
//   Name:     appointment_deposit_request
//   Category: UTILITY  (transaccional, sin opt-in)
//   Language: Spanish (es)
//   Header:   (vacío)
//   Body:     copiar `TEMPLATE_BODY` debajo (incluye {{1}} = nombre paciente)
//   Footer:   (vacío, opcional: "Bioalergia · Concepción")
//   Buttons:  (vacío)
//
// Helper `sendAppointmentDepositRequest()` queda listo para usarse una vez
// Meta apruebe el template (~24h típico para UTILITY).

import { sendTemplateMessage } from "../graph-client.ts";

export const APPOINTMENT_DEPOSIT_TEMPLATE_NAME = "appointment_deposit_request";
export const APPOINTMENT_DEPOSIT_TEMPLATE_LANGUAGE = "es";

// Texto exacto a registrar en Meta Business Manager.
// {{1}} = nombre del paciente.
export const TEMPLATE_BODY = `Hola {{1}}, gracias por agendar tu consulta de Alergología e Inmunología en Bioalergia.

Para confirmar tu hora necesitamos un abono previo equivalente al 50% del valor de la consulta:

• Fonasa: $50.000 (abono $25.000)
• Isapre o particular: $60.000 (abono $30.000)

Datos de transferencia:
Titular: Dr. José Manuel Martínez y Compañía Limitada
RUT: 76.406.172-1
Banco: Mercado Pago
Tipo: Cuenta Vista
N°: 1076536761
Correo: finanzas@bioalergia.cl

Envíanos el comprobante por este mismo chat para confirmar tu hora. ¡Gracias!`;

export async function sendAppointmentDepositRequest(args: {
  phoneNumberId: string;
  toE164: string;
  patientName: string;
}) {
  return await sendTemplateMessage({
    phoneNumberId: args.phoneNumberId,
    toE164: args.toE164,
    templateName: APPOINTMENT_DEPOSIT_TEMPLATE_NAME,
    language: APPOINTMENT_DEPOSIT_TEMPLATE_LANGUAGE,
    components: [
      {
        type: "body",
        parameters: [{ type: "text", text: args.patientName }],
      },
    ],
  });
}
