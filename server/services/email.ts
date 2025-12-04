import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { smtpConfig } from "../config.js";
import { logEvent, logWarn } from "../lib/logger.js";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!smtpConfig) {
    throw new Error("SMTP no está configurado. Revisa las variables de entorno SMTP_HOST, SMTP_USER, SMTP_PASS.");
  }

  // Resetear transporter para forzar reconexión con debug
  transporter = null;

  console.log("=".repeat(60));
  console.log("[SMTP DEBUG] Creando transporter con configuración:");
  console.log(`  Host: ${smtpConfig.host}`);
  console.log(`  Port: ${smtpConfig.port}`);
  console.log(`  Secure (SSL): ${smtpConfig.secure}`);
  console.log(`  User: ${smtpConfig.user}`);
  console.log(`  Pass: ${"*".repeat(Math.min(smtpConfig.pass.length, 8))}...`);
  console.log(`  From: ${smtpConfig.from}`);
  console.log("=".repeat(60));

  transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure, // true para 465, false para otros puertos
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
    // Timeouts para evitar esperas largas
    connectionTimeout: 15000, // 15 segundos para conectar
    greetingTimeout: 15000, // 15 segundos para saludo SMTP
    socketTimeout: 30000, // 30 segundos para operaciones
    // DEBUG: Siempre activar logging para diagnosticar
    logger: true,
    debug: true,
    // TLS options para debug
    tls: {
      rejectUnauthorized: false, // Temporalmente para debug - aceptar certificados self-signed
    },
  });

  // Event listeners para debug
  transporter.on("error", (err) => {
    console.error("[SMTP DEBUG] Transporter error event:", err);
  });

  return transporter;
}

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
};

export async function sendTimesheetEmail(
  data: TimesheetEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!smtpConfig) {
    console.error("[SMTP DEBUG] smtpConfig es null - variables de entorno no configuradas");
    return { success: false, error: "SMTP no configurado" };
  }

  console.log("\n" + "=".repeat(60));
  console.log("[SMTP DEBUG] Iniciando envío de email");
  console.log(`  Destinatario: ${data.employeeEmail}`);
  console.log(`  Mes: ${data.month}`);
  console.log(`  Tamaño PDF: ${data.pdfBuffer.length} bytes`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  logEvent("email:timesheet:start", {
    to: data.employeeEmail,
    month: data.month,
    host: smtpConfig.host,
    port: smtpConfig.port,
  });

  try {
    console.log("[SMTP DEBUG] Obteniendo transporter...");
    const transport = getTransporter();

    // Verificar conexión antes de enviar
    console.log("[SMTP DEBUG] Verificando conexión SMTP...");
    const verifyStartTime = Date.now();
    logEvent("email:timesheet:verifying", { host: smtpConfig.host });
    try {
      await transport.verify();
      const verifyDuration = Date.now() - verifyStartTime;
      console.log(`[SMTP DEBUG] ✅ Conexión verificada en ${verifyDuration}ms`);
      logEvent("email:timesheet:verified", { host: smtpConfig.host, duration: verifyDuration });
    } catch (verifyError) {
      const verifyDuration = Date.now() - verifyStartTime;
      const verifyMsg = verifyError instanceof Error ? verifyError.message : "Error de verificación";
      const verifyStack = verifyError instanceof Error ? verifyError.stack : "";
      console.error(`[SMTP DEBUG] ❌ Verificación falló después de ${verifyDuration}ms`);
      console.error(`[SMTP DEBUG] Error: ${verifyMsg}`);
      console.error(`[SMTP DEBUG] Stack: ${verifyStack}`);
      console.error(`[SMTP DEBUG] Error completo:`, verifyError);
      logWarn("email:timesheet:verify-failed", {
        error: verifyMsg,
        host: smtpConfig.host,
        port: smtpConfig.port,
        duration: verifyDuration,
      });
      return { success: false, error: `No se pudo conectar al servidor de correo: ${verifyMsg}` };
    }

    // Formatear montos a CLP
    const fmtCLP = (n: number) =>
      n.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });

    // Construir el cuerpo del email en HTML
    const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
      <tr>
        <th>Concepto</th>
        <th class="amount">Detalle</th>
      </tr>
      <tr>
        <td>Función</td>
        <td class="amount">${data.role}</td>
      </tr>
      <tr>
        <td>Horas trabajadas</td>
        <td class="amount">${data.hoursWorked}</td>
      </tr>
      <tr>
        <td>Horas extras</td>
        <td class="amount">${data.overtime}</td>
      </tr>
      <tr>
        <td>Tarifa por hora</td>
        <td class="amount">${fmtCLP(data.hourlyRate)}</td>
      </tr>
      <tr>
        <td>Monto extras</td>
        <td class="amount">${fmtCLP(data.overtimeAmount)}</td>
      </tr>
      <tr>
        <td>Subtotal</td>
        <td class="amount">${fmtCLP(data.subtotal)}</td>
      </tr>
      <tr>
        <td>Retención</td>
        <td class="amount">${fmtCLP(data.retention)}</td>
      </tr>
      <tr class="total-row">
        <td>Total Líquido</td>
        <td class="amount">${fmtCLP(data.netAmount)}</td>
      </tr>
    </table>
    
    <div class="pay-date">
      <strong>📅 Fecha de pago estimada: ${data.payDate}</strong>
    </div>
    
    <div class="attachment-note">
      <strong>📎 Adjunto:</strong> Se incluye el documento PDF con el detalle completo de horas trabajadas.
    </div>
  </div>
  
  <div class="footer">
    <p>Este correo fue generado automáticamente. Si tienes dudas, contacta al área de administración.</p>
  </div>
</body>
</html>
`;

    // Texto plano alternativo
    const textBody = `
Boleta de Honorarios - ${data.month}
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
Este correo fue generado automáticamente.
`;

    const mailOptions = {
      from: `"Bioalergia" <${smtpConfig.from}>`,
      to: data.employeeEmail,
      subject: `Boleta de Honorarios - ${data.month} - ${data.employeeName}`,
      text: textBody,
      html: htmlBody,
      attachments: [
        {
          filename: data.pdfFilename,
          content: data.pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    console.log("[SMTP DEBUG] Preparando email para envío...");
    logEvent("email:timesheet:sending", { to: data.employeeEmail });

    const sendStartTime = Date.now();
    console.log("[SMTP DEBUG] Llamando sendMail...");
    const info = await transport.sendMail(mailOptions);
    const sendDuration = Date.now() - sendStartTime;

    console.log(`[SMTP DEBUG] ✅ Email enviado en ${sendDuration}ms`);
    console.log(`[SMTP DEBUG] Message ID: ${info.messageId}`);
    console.log(`[SMTP DEBUG] Response: ${info.response}`);

    logEvent("email:timesheet:sent", {
      to: data.employeeEmail,
      month: data.month,
      messageId: info.messageId,
      duration: sendDuration,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    const errorStack = error instanceof Error ? error.stack : "";
    const errorCode = (error as NodeJS.ErrnoException)?.code;
    const errorErrno = (error as NodeJS.ErrnoException)?.errno;
    const errorSyscall = (error as NodeJS.ErrnoException)?.syscall;

    console.error("[SMTP DEBUG] ❌ Error al enviar email");
    console.error(`[SMTP DEBUG] Mensaje: ${errorMessage}`);
    console.error(`[SMTP DEBUG] Código: ${errorCode}`);
    console.error(`[SMTP DEBUG] Errno: ${errorErrno}`);
    console.error(`[SMTP DEBUG] Syscall: ${errorSyscall}`);
    console.error(`[SMTP DEBUG] Stack: ${errorStack}`);
    console.error(`[SMTP DEBUG] Error completo:`, error);

    logWarn("email:timesheet:error", {
      error: errorMessage,
      code: errorCode,
      errno: errorErrno,
      syscall: errorSyscall,
      to: data.employeeEmail,
      host: smtpConfig?.host,
      port: smtpConfig?.port,
    });

    // Mensajes de error más amigables
    let userMessage = errorMessage;
    if (errorCode === "ECONNREFUSED") {
      userMessage = "No se pudo conectar al servidor de correo. Verifica la configuración SMTP.";
    } else if (errorCode === "ETIMEDOUT" || errorMessage.includes("timeout")) {
      userMessage = "Tiempo de espera agotado al conectar con el servidor de correo.";
    } else if (errorCode === "EAUTH" || errorMessage.includes("authentication")) {
      userMessage = "Error de autenticación con el servidor de correo. Verifica usuario y contraseña.";
    }

    return { success: false, error: userMessage };
  }
}

// Verificar conexión SMTP
export async function verifySmtpConnection(): Promise<{ success: boolean; error?: string }> {
  if (!smtpConfig) {
    return { success: false, error: "SMTP no configurado" };
  }

  try {
    const transport = getTransporter();
    await transport.verify();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return { success: false, error: errorMessage };
  }
}
