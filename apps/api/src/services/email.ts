import { logEvent } from "../lib/logger.ts";
import { buildTimesheetEmailComposition } from "./timesheet-email-template.ts";

/**
 * Genera un archivo .eml que el usuario puede abrir con Outlook/Mail
 * para enviar el email manualmente (solo presionar "Enviar")
 */

export type TimesheetEmailData = {
  employeeName: string;
  employeeEmail: string;
  role: string;
  month: string; // "Diciembre 2025"
  hoursWorked: string; // "120:00"
  overtime: string; // "05:30"
  hourlyRate: number;
  overtimeAmount: number;
  subtotal: number;
  retention: number;
  retentionRate: number; // 0.145 = 14.5%
  netAmount: number;
  payDate: string; // "05-01-2026"
  pdfBuffer: Buffer;
  pdfFilename: string;
  fromEmail: string; // Email del remitente
  fromName: string; // Nombre del remitente
};

/**
 * Genera un archivo .eml con el email listo para enviar
 * El usuario solo tiene que abrir el archivo y presionar "Enviar"
 */
export function generateTimesheetEml(data: TimesheetEmailData): {
  success: boolean;
  emlContent: string;
  filename: string;
} {
  const parseHours = (h: string) => {
    const [hrs, mins] = h.split(":").map(Number);
    return (hrs || 0) * 60 + (mins || 0);
  };

  const { html, subject, text } = buildTimesheetEmailComposition({
    employeeName: data.employeeName,
    monthLabel: data.month,
    summary: {
      net: data.netAmount,
      overtimeMinutes: parseHours(data.overtime),
      payDate: data.payDate,
      retention: data.retention,
      retentionRate: data.retentionRate,
      role: data.role,
      subtotal: data.subtotal,
      workedMinutes: parseHours(data.hoursWorked),
    },
  });
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const boundaryAlt = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  // Codificar subject para caracteres especiales
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  // Codificar nombre del remitente
  const encodedFromName = `=?UTF-8?B?${Buffer.from(data.fromName).toString("base64")}?=`;

  // Construir el archivo .eml (formato RFC 822 MIME)
  // Headers para marcar como borrador/no enviado
  const emlContent = `MIME-Version: 1.0
From: ${encodedFromName} <${data.fromEmail}>
To: ${data.employeeName} <${data.employeeEmail}>
Subject: ${encodedSubject}
Content-Type: multipart/mixed; boundary="${boundary}"
X-Unsent: 1
X-Mozilla-Status: 0000
X-Mozilla-Status2: 00800000
Status: O

--${boundary}
Content-Type: multipart/alternative; boundary="${boundaryAlt}"

--${boundaryAlt}
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: base64

${
  Buffer.from(text)
    .toString("base64")
    .match(/.{1,76}/g)
    ?.join("\n") || ""
}

--${boundaryAlt}
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: base64

${
  Buffer.from(html)
    .toString("base64")
    .match(/.{1,76}/g)
    ?.join("\n") || ""
}

--${boundaryAlt}--

--${boundary}
Content-Type: application/pdf; name="${data.pdfFilename}"
Content-Disposition: attachment; filename="${data.pdfFilename}"
Content-Transfer-Encoding: base64

${
  data.pdfBuffer
    .toString("base64")
    .match(/.{1,76}/g)
    ?.join("\n") || ""
}

--${boundary}--
`;

  // Nombre del archivo .eml
  const safeName = data.employeeName.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_");
  const safeMonth = data.month.replace(/\s+/g, "_");
  const filename = `Email_Boleta_${safeName}_${safeMonth}.eml`;

  logEvent("email:eml:generated", {
    to: data.employeeEmail,
    month: data.month,
    filename,
  });

  return { success: true, emlContent, filename };
}

// Ya no se necesita verificar SMTP - ahora generamos archivos .eml
