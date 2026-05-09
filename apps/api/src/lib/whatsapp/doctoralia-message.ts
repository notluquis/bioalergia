import { getSetting } from "../../services/settings.ts";
import { formatChileDateTime } from "../time.ts";
import { parseDoctoraliaEmail } from "./email-parser.ts";

const WHATSAPP_FREEFORM_MESSAGE_SETTING_KEY = "whatsapp.freeformMessage";

const DEFAULT_WHATSAPP_FREEFORM_MESSAGE = [
  "*Bioalergia*",
  "",
  "Hola {{patientName}}, te escribimos por tu reserva en Doctoralia.",
  "",
  "Profesional: {{appointmentDoctor}}",
  "Fecha y hora: {{appointmentDate}}",
  "",
  "*Valor a pagar: $60.000*",
  "",
  "Para confirmar la hora, es necesario realizar el pago. Si no se realiza, la hora podra ser otorgada a otro paciente.",
  "",
  "*Opciones de pago*",
  "• Link Mercado Pago: http://link.mercadopago.cl/bioalergia",
  "• Transferencia:",
  "  *DR. JOSE MANUEL MARTINEZ Y COMPANIA LIMITADA*",
  "  *RUT:* 764061721",
  "  *Banco:* Mercado Pago",
  "  *Tipo de cuenta:* Cuenta Vista",
  "  *Numero de cuenta:* 1076536761",
  "  *Correo:* finanzas@bioalergia.cl",
  "",
  "Cuando realices el pago, envia el comprobante por aqui para dejarlo registrado.",
].join("\n");

export async function getDoctoraliaMessageTemplate() {
  const storedTemplate = await getSetting(WHATSAPP_FREEFORM_MESSAGE_SETTING_KEY);
  const template = storedTemplate?.trim();
  return template || DEFAULT_WHATSAPP_FREEFORM_MESSAGE;
}

export async function buildDoctoraliaMessage(
  booking: NonNullable<ReturnType<typeof parseDoctoraliaEmail>>,
) {
  const template = await getDoctoraliaMessageTemplate();
  const appointmentDate = booking.appointmentDate
    ? formatChileDateTime(booking.appointmentDate)
    : "";
  const replacements: Record<string, string> = {
    appointmentDate,
    appointmentDoctor: booking.appointmentDoctor ?? "",
    appointmentService: booking.appointmentService ?? "",
    clinicAddress: booking.clinicAddress ?? "",
    patientName: booking.patientName,
  };

  return template
    .replace(/\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g, (_match, doubleKey: string, singleKey: string) => {
      const key = doubleKey || singleKey;
      return replacements[key] ?? "";
    })
    .split("\n")
    .filter((line, index, allLines) => {
      if (line.trim() !== "") return true;
      return index > 0 && allLines[index - 1]?.trim() !== "";
    })
    .join("\n");
}
