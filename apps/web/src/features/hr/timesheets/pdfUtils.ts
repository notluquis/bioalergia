import { formatRetentionPercent } from "@shared/retention";
import dayjs from "dayjs";
import ky from "ky";

import type { Employee } from "@/features/hr/employees/types";

import type { BulkRow, TimesheetSummaryRow } from "./types";

/**
 * Generates a PDF document as base64 string for a timesheet
 * Uses jspdf and jspdf-autotable dynamically imported for code-splitting
 */
export async function generateTimesheetPdfBase64(
  employee: Employee,
  summaryRow: TimesheetSummaryRow,
  bulkRows: BulkRow[],
  monthLabel: string
): Promise<string | null> {
  try {
    const [{ default: jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const autoTable = (autoTableModule.default ?? autoTableModule) as typeof autoTableModule.default;
    const doc = new jsPDF();

    const margin = 10;

    // Try to load and add logo
    try {
      const logoBlob = await ky.get("/logo_sin_eslogan.png").blob();
      const logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(reader.result as string));
        reader.readAsDataURL(logoBlob);
      });
      doc.addImage(logoBase64, "PNG", margin, 5, 40, 12);
    } catch {
      console.warn("Could not load logo for PDF");
    }

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Boleta de Honorarios", margin, 30);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Servicios de ${summaryRow.role}`, margin, 38);
    doc.text(`Periodo: ${monthLabel}`, margin, 45);

    // Employee info
    doc.text(`Prestador: ${employee.full_name}`, margin, 58);
    doc.text(`RUT: ${employee.person?.rut || "-"}`, margin, 65);

    // Summary table
    const fmtCLP = (n: number) =>
      n.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });

    // Use retention rate from backend summary (already calculated with correct year)
    const retentionPercent = formatRetentionPercent(summaryRow.retentionRate || 0);

    autoTable(doc, {
      head: [["Concepto", "Valor"]],
      body: [
        ["Horas trabajadas", summaryRow.hoursFormatted],
        ["Horas extras", summaryRow.overtimeFormatted],
        ["Tarifa por hora", fmtCLP(summaryRow.hourlyRate)],
        ["Subtotal", fmtCLP(summaryRow.subtotal)],
        [`Retención (${retentionPercent})`, `-${fmtCLP(summaryRow.retention)}`],
        ["Total líquido", fmtCLP(summaryRow.net)],
      ],
      startY: 75,
      theme: "grid",
      styles: { fontSize: 10 },
      headStyles: { fillColor: [14, 100, 183] },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: margin, right: margin },
    });

    // Detail table
    const lastTableRef = doc as unknown as { lastAutoTable?: { finalY: number } };
    const nextY = lastTableRef.lastAutoTable ? lastTableRef.lastAutoTable.finalY + 10 : 120;

    const detailBody = bulkRows
      .filter((row) => row.entrada || row.salida)
      .map((row) => [dayjs(row.date).format("DD-MM-YYYY"), row.entrada || "-", row.salida || "-", row.overtime || "-"]);

    if (detailBody.length > 0) {
      autoTable(doc, {
        head: [["Fecha", "Entrada", "Salida", "Extras"]],
        body: detailBody,
        startY: nextY,
        theme: "grid",
        styles: { fontSize: 9, halign: "center" },
        headStyles: { fillColor: [241, 167, 34], halign: "center" },
        margin: { left: margin, right: margin },
      });
    }

    // Convert to base64
    const pdfBlob = doc.output("blob");
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1] || "";
        resolve(base64);
      });
      reader.addEventListener("error", () => resolve(null), { once: true });
      reader.readAsDataURL(pdfBlob);
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return null;
  }
}
