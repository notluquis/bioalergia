type TimesheetEmailSummary = {
  net: number;
  overtimeMinutes?: number | null;
  payDate: string;
  retention: number;
  retention_rate?: null | number;
  retentionRate?: null | number;
  role: string;
  subtotal: number;
  workedMinutes?: number | null;
};

export type TimesheetEmailCompositionInput = {
  employeeName: string;
  monthLabel: string;
  summary: TimesheetEmailSummary;
};

export function buildTimesheetEmailComposition({
  employeeName,
  monthLabel,
  summary,
}: TimesheetEmailCompositionInput) {
  const totalHoursFormatted = formatWorkedTime(
    (summary.workedMinutes ?? 0) + (summary.overtimeMinutes ?? 0),
  );
  const retentionPercent = formatRetentionPercent(
    summary.retentionRate ?? summary.retention_rate ?? 0.1275,
  );
  const boletaDescription = `SERVICIOS PROFESIONALES DE ${summary.role.toUpperCase()} - PERIODO ${monthLabel.toUpperCase()} - TIEMPO FACTURABLE ${totalHoursFormatted}`;
  const subject = `Boleta de Honorarios - ${monthLabel} - ${employeeName}`;
  const payDateLabel = formatDisplayDate(summary.payDate);

  return {
    html: buildHtml({
      boletaDescription,
      employeeName,
      monthLabel,
      payDateLabel,
      retentionPercent,
      summary,
      totalHoursFormatted,
    }),
    subject,
    text: buildText({
      boletaDescription,
      employeeName,
      monthLabel,
      payDateLabel,
      retentionPercent,
      summary,
      totalHoursFormatted,
    }),
  };
}

function buildText({
  boletaDescription,
  employeeName,
  monthLabel,
  payDateLabel,
  retentionPercent,
  summary,
  totalHoursFormatted,
}: {
  boletaDescription: string;
  employeeName: string;
  monthLabel: string;
  payDateLabel: string;
  retentionPercent: string;
  summary: TimesheetEmailSummary;
  totalHoursFormatted: string;
}) {
  return [
    `Boleta de Honorarios - ${monthLabel}`,
    "",
    `Estimado/a ${employeeName},`,
    "",
    `Comparto el resumen de prestaciones a honorarios correspondientes al periodo ${monthLabel}, para tu revisión y emisión de la Boleta de Honorarios Electrónica (BHE).`,
    "",
    "Datos sugeridos para la emisión:",
    `- Descripción: ${boletaDescription}`,
    `- Monto bruto: ${formatClp(summary.subtotal)}`,
    "",
    "Resumen del periodo:",
    `- Tiempo total facturable: ${totalHoursFormatted}`,
    `- Monto bruto honorarios: ${formatClp(summary.subtotal)}`,
    `- Retención (${retentionPercent}): ${formatClp(summary.retention)}`,
    `- Líquido estimado: ${formatClp(summary.net)}`,
    "",
    `Fecha estimada de pago: ${payDateLabel}`,
    "",
    "Se adjunta el documento PDF con el detalle del periodo para respaldo y conciliación.",
    "",
    "Nota: El detalle adjunto se incluye únicamente para fines de respaldo/conciliación de honorarios y no constituye control de jornada ni implica subordinación o dependencia.",
  ].join("\n");
}

function buildHtml({
  boletaDescription,
  employeeName,
  monthLabel,
  payDateLabel,
  retentionPercent,
  summary,
  totalHoursFormatted,
}: {
  boletaDescription: string;
  employeeName: string;
  monthLabel: string;
  payDateLabel: string;
  retentionPercent: string;
  summary: TimesheetEmailSummary;
  totalHoursFormatted: string;
}) {
  const escapedEmployeeName = escapeHtml(employeeName);
  const escapedMonthLabel = escapeHtml(monthLabel);
  const escapedDescription = escapeHtml(boletaDescription);
  const escapedPayDate = escapeHtml(payDateLabel);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Boleta de Honorarios - ${escapedMonthLabel}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f6;color:#0f172a;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef2f6;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;">
          <tr>
            <td style="padding-bottom:12px;text-align:center;font-size:12px;line-height:18px;color:#64748b;">
              Bioalergia · Resumen para emisión de boleta de honorarios
            </td>
          </tr>
          <tr>
            <td style="border:1px solid #dbe3ec;border-radius:22px;background-color:#ffffff;overflow:hidden;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="height:6px;background-color:#0e64b7;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 22px;border-bottom:1px solid #e2e8f0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="left" style="padding-bottom:18px;">
                          <img src="https://intranet.bioalergia.cl/logo_sin_eslogan.png" alt="Bioalergia" width="144" style="display:block;width:144px;max-width:100%;height:auto;border:0;" />
                        </td>
                        <td align="right" style="padding-bottom:18px;font-size:12px;line-height:16px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">
                          ${escapedMonthLabel}
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2">
                          <div style="font-size:12px;line-height:16px;font-weight:700;color:#0e64b7;letter-spacing:0.08em;text-transform:uppercase;">Resumen de servicios a honorarios</div>
                          <h1 style="margin:12px 0 6px;font-size:29px;line-height:34px;font-weight:700;color:#0f172a;">Boleta de Honorarios</h1>
                          <p style="margin:0;font-size:15px;line-height:22px;color:#475569;">Servicios de ${escapeHtml(summary.role)} · ${escapedMonthLabel}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;background-color:#ffffff;">
                    <p style="margin:0 0 14px;font-size:16px;line-height:26px;color:#0f172a;">Estimado/a <strong>${escapedEmployeeName}</strong>,</p>
                    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#334155;">Comparto el resumen de prestaciones profesionales a honorarios correspondientes al periodo <strong>${escapedMonthLabel}</strong>, para tu revisión y posterior emisión de la Boleta de Honorarios Electrónica.</p>
                    <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#334155;">El PDF adjunto contiene el detalle del periodo para respaldo y conciliación. Debajo encontrarás los datos sugeridos para la emisión.</p>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;background-color:#f8fbff;border:1px solid #d6e8fb;border-radius:18px;">
                      <tr>
                        <td style="padding:22px 22px 20px;">
                          <div style="margin:0 0 12px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#0e64b7;">Datos sugeridos para emisión</div>
                          <div style="margin:0 0 6px;font-size:13px;line-height:18px;color:#64748b;">Descripción sugerida</div>
                          <div style="margin:0 0 18px;font-size:18px;line-height:28px;font-weight:700;color:#0f172a;">${escapedDescription}</div>
                          <div style="margin:0 0 6px;font-size:13px;line-height:18px;color:#64748b;">Monto bruto honorarios</div>
                          <div style="font-size:34px;line-height:38px;font-weight:700;color:#0e64b7;">${escapeHtml(formatClp(summary.subtotal))}</div>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;border:1px solid #e2e8f0;border-radius:18px;background-color:#ffffff;">
                      <tr>
                        <td style="padding:0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr style="background-color:#f8fafc;">
                              <td style="padding:14px 18px;font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Concepto</td>
                              <td style="padding:14px 18px;font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;text-align:right;border-bottom:1px solid #e2e8f0;">Detalle</td>
                            </tr>
                            ${buildSummaryRow("Tiempo total facturable", totalHoursFormatted)}
                            ${buildSummaryRow("Monto bruto de honorarios", formatClp(summary.subtotal))}
                            ${buildSummaryRow(`Retención (${retentionPercent})`, `-${formatClp(summary.retention)}`)}
                            <tr style="background-color:#0e64b7;">
                              <td style="padding:15px 18px;font-size:16px;line-height:22px;font-weight:700;color:#ffffff;">Líquido estimado</td>
                              <td style="padding:15px 18px;font-size:16px;line-height:22px;font-weight:700;color:#ffffff;text-align:right;">${escapeHtml(formatClp(summary.net))}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px;background-color:#fff7ed;border:1px solid #fdba74;border-radius:14px;">
                      <tr>
                        <td style="padding:15px 18px;font-size:14px;line-height:20px;font-weight:700;color:#9a3412;text-align:center;">
                          Fecha estimada de pago: ${escapedPayDate}
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px;background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:14px;">
                      <tr>
                        <td style="padding:14px 18px;font-size:14px;line-height:22px;color:#334155;">
                          <strong>Adjunto:</strong> Resumen PDF del periodo para respaldo y conciliación.
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0;font-size:12px;line-height:20px;color:#64748b;">Nota: El detalle adjunto se incluye únicamente para fines de respaldo/conciliación de honorarios y no constituye control de jornada ni implica subordinación o dependencia.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSummaryRow(label: string, value: string) {
  return `<tr>
    <td style="padding:14px 18px;font-size:15px;line-height:22px;color:#0f172a;border-bottom:1px solid #e2e8f0;">${escapeHtml(label)}</td>
    <td style="padding:14px 18px;font-size:15px;line-height:22px;color:#0f172a;text-align:right;border-bottom:1px solid #e2e8f0;">${escapeHtml(value)}</td>
  </tr>`;
}

function formatClp(amount: number) {
  return amount.toLocaleString("es-CL", {
    currency: "CLP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: "currency",
  });
}

function formatDisplayDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}-${month}-${year}`;
  }
  return value;
}

function formatRetentionPercent(rate: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(rate * 100) + "%";
}

function formatWorkedTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
