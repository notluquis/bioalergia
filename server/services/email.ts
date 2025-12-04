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

  // Texto plano
  const textBody = `Boleta de Honorarios - ${data.month}
Servicios de ${data.role}

Estimado/a ${data.employeeName},

A continuación el resumen de tus servicios prestados:

- Función: ${data.role}
- Horas trabajadas: ${data.hoursWorked}
- Horas extras: ${data.overtime}
- Tarifa por hora: ${fmtCLP(data.hourlyRate)}
- Monto extras: ${fmtCLP(data.overtimeAmount)}
- Subtotal: ${fmtCLP(data.subtotal)}
- Retención: ${fmtCLP(data.retention)}
- Total Líquido: ${fmtCLP(data.netAmount)}

Fecha de pago estimada: ${data.payDate}

Se adjunta el documento PDF con el detalle completo.

---
Este correo fue generado automáticamente.`;

  // HTML del email
  const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Boleta de Honorarios - ${data.month}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0e64b7 0%, #1a7fd1 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
    .content { background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; }
    .greeting { font-size: 16px; margin-bottom: 20px; }
    .summary-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary-table th, .summary-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    .summary-table th { background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-table td { font-size: 15px; }
    .summary-table tr:last-child td { border-bottom: none; }
    .amount { text-align: right; font-family: 'Consolas', monospace; }
    .total-row { background: #0e64b7 !important; color: white; }
    .total-row td { font-weight: 700; font-size: 16px; border-bottom: none !important; }
    .footer { background: #f1f5f9; padding: 20px 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; text-align: center; }
    .footer p { margin: 0; color: #64748b; font-size: 13px; }
    .pay-date { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin: 16px 0; text-align: center; }
    .pay-date strong { color: #92400e; }
    .attachment-note { background: #e0f2fe; border: 1px solid #0ea5e9; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 14px; }
    .attachment-note strong { color: #0369a1; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Boleta de Honorarios</h1>
    <p>Servicios de ${data.role} - ${data.month}</p>
  </div>
  <div class="content">
    <p class="greeting">Estimado/a <strong>${data.employeeName}</strong>,</p>
    <p>A continuación encontrarás el resumen de los servicios prestados durante el periodo <strong>${data.month}</strong>:</p>
    <table class="summary-table">
      <tr><th>Concepto</th><th class="amount">Detalle</th></tr>
      <tr><td>Función</td><td class="amount">${data.role}</td></tr>
      <tr><td>Horas trabajadas</td><td class="amount">${data.hoursWorked}</td></tr>
      <tr><td>Horas extras</td><td class="amount">${data.overtime}</td></tr>
      <tr><td>Tarifa por hora</td><td class="amount">${fmtCLP(data.hourlyRate)}</td></tr>
      <tr><td>Monto extras</td><td class="amount">${fmtCLP(data.overtimeAmount)}</td></tr>
      <tr><td>Subtotal</td><td class="amount">${fmtCLP(data.subtotal)}</td></tr>
      <tr><td>Retención</td><td class="amount">${fmtCLP(data.retention)}</td></tr>
      <tr class="total-row"><td>Total Líquido</td><td class="amount">${fmtCLP(data.netAmount)}</td></tr>
    </table>
    <div class="pay-date"><strong>📅 Fecha de pago estimada: ${data.payDate}</strong></div>
    <div class="attachment-note"><strong>📎 Adjunto:</strong> Se incluye el documento PDF con el detalle completo de horas trabajadas.</div>
  </div>
  <div class="footer"><p>Este correo fue generado automáticamente. Si tienes dudas, contacta al área de administración.</p></div>
</body>
</html>`;

  // Codificar subject para caracteres especiales
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  // Codificar nombre del remitente
  const encodedFromName = `=?UTF-8?B?${Buffer.from(data.fromName).toString("base64")}?=`;

  // Construir el archivo .eml (formato RFC 822 MIME)
  const emlContent = `MIME-Version: 1.0
From: ${encodedFromName} <${data.fromEmail}>
To: ${data.employeeName} <${data.employeeEmail}>
Subject: ${encodedSubject}
Content-Type: multipart/mixed; boundary="${boundary}"
X-Unsent: 1

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
