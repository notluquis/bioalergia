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

  // HTML del email - Usar tablas para máxima compatibilidad con clientes de email
  // Estructura: tabla externa para centrar, tabla interna con contenido
  const htmlBody = `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Boleta de Honorarios - ${data.month}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    @media only screen and (max-width: 620px) {
      .wrapper { width: 100% !important; max-width: 100% !important; }
      .content-cell { padding: 16px !important; }
      .header-cell { padding: 20px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <!-- Tabla externa para centrar -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <!-- Tabla contenedora principal -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="wrapper" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header azul -->
          <tr>
            <td align="center" class="header-cell" style="background-color: #0e64b7; padding: 32px 24px;">
              <!-- Logo centrado -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color: #ffffff; padding: 12px 24px; border-radius: 12px;">
                    <img src="https://intranet.bioalergia.cl/logo_sin_eslogan.png" alt="Bioalergia" width="160" style="display: block; max-width: 160px; height: auto;" />
                  </td>
                </tr>
              </table>
              <!-- Título centrado -->
              <h1 style="margin: 20px 0 8px; font-size: 24px; font-weight: 600; color: #ffffff; text-align: center;">Boleta de Honorarios</h1>
              <p style="margin: 0; font-size: 15px; color: #ffffff; text-align: center;">Servicios de ${data.role} - ${data.month}</p>
            </td>
          </tr>
          <!-- Contenido -->
          <tr>
            <td class="content-cell" style="padding: 28px 24px; background-color: #f8fafc;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.6;">Estimado/a <strong>${data.employeeName}</strong>,</p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #333333; line-height: 1.6;">A continuación encontrarás el resumen de los servicios prestados durante el periodo <strong>${data.month}</strong>, favor corroborar y emitir boleta de honorarios.</p>
              
              <!-- Caja verde para boleta -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #dcfce7; border: 2px solid #22c55e; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 16px; font-size: 12px; color: #166534; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">📝 Para la boleta de honorarios</p>
                    <p style="margin: 0 0 4px; font-size: 12px; color: #166534;">Descripción:</p>
                    <p style="margin: 0 0 16px; font-size: 15px; font-weight: 700; color: #166534; font-family: 'Consolas', 'Courier New', monospace;">${boletaDescription}</p>
                    <p style="margin: 0 0 4px; font-size: 12px; color: #166534;">Monto Bruto:</p>
                    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #166534; font-family: 'Consolas', 'Courier New', monospace;">${fmtCLP(data.subtotal)}</p>
                  </td>
                </tr>
              </table>
              
              <!-- Tabla de resumen -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px;">
                <tr style="background-color: #f1f5f9;">
                  <th style="padding: 14px 16px; text-align: left; font-weight: 600; color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">Concepto</th>
                  <th style="padding: 14px 16px; text-align: right; font-weight: 600; color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">Detalle</th>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; text-align: left; font-size: 15px; color: #333333; border-bottom: 1px solid #e2e8f0;">Horas totales</td>
                  <td style="padding: 14px 16px; text-align: right; font-size: 15px; font-family: 'Consolas', 'Courier New', monospace; color: #333333; border-bottom: 1px solid #e2e8f0;">${totalHoursFormatted}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; text-align: left; font-size: 15px; color: #333333; border-bottom: 1px solid #e2e8f0;">Monto Bruto</td>
                  <td style="padding: 14px 16px; text-align: right; font-size: 15px; font-family: 'Consolas', 'Courier New', monospace; color: #333333; border-bottom: 1px solid #e2e8f0;">${fmtCLP(data.subtotal)}</td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; text-align: left; font-size: 15px; color: #333333; border-bottom: 1px solid #e2e8f0;">Retención (${(data.retentionRate * 100).toFixed(1).replace(".", ",")}%)</td>
                  <td style="padding: 14px 16px; text-align: right; font-size: 15px; font-family: 'Consolas', 'Courier New', monospace; color: #333333; border-bottom: 1px solid #e2e8f0;">-${fmtCLP(data.retention)}</td>
                </tr>
                <tr style="background-color: #0e64b7;">
                  <td style="padding: 14px 16px; text-align: left; font-size: 16px; font-weight: 700; color: #ffffff;">Total Líquido</td>
                  <td style="padding: 14px 16px; text-align: right; font-size: 16px; font-weight: 700; font-family: 'Consolas', 'Courier New', monospace; color: #ffffff;">${fmtCLP(data.netAmount)}</td>
                </tr>
              </table>
              
              <!-- Fecha de pago -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; margin-bottom: 16px;">
                <tr>
                  <td align="center" style="padding: 14px 16px;">
                    <strong style="color: #92400e; font-size: 14px;">📅 Fecha de pago estimada: ${data.payDate}</strong>
                  </td>
                </tr>
              </table>
              
              <!-- Nota de adjunto -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #e0f2fe; border: 1px solid #0ea5e9; border-radius: 8px;">
                <tr>
                  <td style="padding: 14px 16px; font-size: 14px; color: #0369a1;">
                    <strong>📎 Adjunto:</strong> Se incluye el documento PDF con el detalle completo de horas trabajadas.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="background-color: #f1f5f9; padding: 20px 24px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 13px; text-align: center;">Este correo fue generado automáticamente. Si tienes dudas, contacta al área de administración.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
