import { logEvent } from "../lib/logger.js";

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
  // Formatear montos a CLP
  const fmtCLP = (n: number) =>
    n.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });

  const subject = `Boleta de Honorarios - ${data.month} - ${data.employeeName}`;
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const boundaryAlt = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  // Calcular horas totales (trabajadas + extras) para la descripción de la boleta
  const parseHours = (h: string) => {
    const [hrs, mins] = h.split(":").map(Number);
    return (hrs || 0) * 60 + (mins || 0);
  };
  const totalMinutes = parseHours(data.hoursWorked) + parseHours(data.overtime);
  const totalHrs = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const totalHoursFormatted = `${String(totalHrs).padStart(2, "0")}:${String(totalMins).padStart(2, "0")}`;
  const boletaDescription = `SERVICIOS DE ${data.role.toUpperCase()} ${totalHoursFormatted} HORAS`;

  // Texto plano
  const textBody = `Boleta de Honorarios - ${data.month}
Servicios de ${data.role}

Estimado/a ${data.employeeName},

A continuación encontrarás el resumen de los servicios prestados durante el periodo ${data.month}, favor corroborar y emitir boleta de honorarios.

PARA LA BOLETA DE HONORARIOS:
- Descripción: ${boletaDescription}
- Monto Bruto: ${fmtCLP(data.subtotal)}

Resumen:
- Horas totales: ${totalHoursFormatted}
- Retención (${(data.retentionRate * 100).toFixed(1).replace(".", ",")}%): ${fmtCLP(data.retention)}
- Total Líquido: ${fmtCLP(data.netAmount)}

Fecha de pago estimada: ${data.payDate}

Se adjunta el documento PDF con el detalle completo de horas trabajadas.

---
Este correo fue generado automáticamente.`;

  // HTML del email - NOTA: Usar estilos inline y colores sólidos para compatibilidad con Outlook
  const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Boleta de Honorarios - ${data.month}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
  <div style="background-color: #0e64b7; color: #ffffff; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
    <div style="display: inline-block; background-color: #ffffff; padding: 12px 20px; border-radius: 12px; margin-bottom: 16px;">
      <img src="https://intranet.bioalergia.cl/logo_sin_eslogan.png" alt="Bioalergia" style="max-width: 160px; height: auto; display: block;" />
    </div>
    <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #ffffff;">Boleta de Honorarios</h1>
    <p style="margin: 8px 0 0; font-size: 14px; color: #ffffff;">Servicios de ${data.role} - ${data.month}</p>
  </div>
  <div style="background-color: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
    <p style="font-size: 16px; margin-bottom: 20px; color: #333333;">Estimado/a <strong>${data.employeeName}</strong>,</p>
    <p style="color: #333333;">A continuación encontrarás el resumen de los servicios prestados durante el periodo <strong>${data.month}</strong>, favor corroborar y emitir boleta de honorarios.</p>
    <div style="background-color: #dcfce7; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #166534; text-transform: uppercase; letter-spacing: 1px;">📝 Para la boleta de honorarios</p>
      <table style="width: 100%; margin-top: 12px;">
        <tr><td style="padding: 8px 0; font-size: 14px; color: #166534;">Descripción:</td><td style="padding: 8px 0; font-size: 15px; font-weight: 700; color: #166534; font-family: 'Consolas', monospace; text-align: right;">${boletaDescription}</td></tr>
        <tr><td style="padding: 8px 0; font-size: 14px; color: #166534;">Monto Bruto:</td><td style="padding: 8px 0; font-size: 18px; font-weight: 700; color: #166534; font-family: 'Consolas', monospace; text-align: right;">${fmtCLP(data.subtotal)}</td></tr>
      </table>
    </div>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <tr><th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Concepto</th><th style="padding: 12px 16px; text-align: right; border-bottom: 1px solid #e2e8f0; background-color: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Detalle</th></tr>
      <tr><td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 15px; color: #333333;">Horas totales</td><td style="padding: 12px 16px; text-align: right; border-bottom: 1px solid #e2e8f0; font-size: 15px; font-family: 'Consolas', monospace; color: #333333;">${totalHoursFormatted}</td></tr>
      <tr><td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 15px; color: #333333;">Monto Bruto</td><td style="padding: 12px 16px; text-align: right; border-bottom: 1px solid #e2e8f0; font-size: 15px; font-family: 'Consolas', monospace; color: #333333;">${fmtCLP(data.subtotal)}</td></tr>
      <tr><td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 15px; color: #333333;">Retención (${(data.retentionRate * 100).toFixed(1).replace(".", ",")}%)</td><td style="padding: 12px 16px; text-align: right; border-bottom: 1px solid #e2e8f0; font-size: 15px; font-family: 'Consolas', monospace; color: #333333;">-${fmtCLP(data.retention)}</td></tr>
      <tr style="background-color: #0e64b7;"><td style="padding: 12px 16px; text-align: left; font-size: 16px; font-weight: 700; color: #ffffff;">Total Líquido</td><td style="padding: 12px 16px; text-align: right; font-size: 16px; font-weight: 700; font-family: 'Consolas', monospace; color: #ffffff;">${fmtCLP(data.netAmount)}</td></tr>
    </table>
    <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin: 16px 0; text-align: center;"><strong style="color: #92400e;">📅 Fecha de pago estimada: ${data.payDate}</strong></div>
    <div style="background-color: #e0f2fe; border: 1px solid #0ea5e9; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 14px;"><strong style="color: #0369a1;">📎 Adjunto:</strong> Se incluye el documento PDF con el detalle completo de horas trabajadas.</div>
  </div>
  <div style="background-color: #f1f5f9; padding: 20px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; text-align: center;"><p style="margin: 0; color: #64748b; font-size: 13px;">Este correo fue generado automáticamente. Si tienes dudas, contacta al área de administración.</p></div>
</body>
</html>`;

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
  Buffer.from(textBody)
    .toString("base64")
    .match(/.{1,76}/g)
    ?.join("\n") || ""
}

--${boundaryAlt}
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: base64

${
  Buffer.from(htmlBody)
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
