import dayjs from "dayjs";
import ky from "ky";
import type { Employee } from "@/features/hr/employees/types";
import { formatRetentionPercent } from "~/shared/retention";

import type { BulkRow, TimesheetSummaryRow } from "./types";

/**
 * Generates a PDF document as base64 string for a timesheet
 * Uses jspdf and jspdf-autotable dynamically imported for code-splitting
 */
export async function generateTimesheetPdfBase64(
  employee: Employee,
  summaryRow: TimesheetSummaryRow,
  bulkRows: BulkRow[],
  monthLabel: string,
): Promise<null | string> {
  try {
    const [{ default: jsPDF }, autoTableModule] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = autoTableModule.default ?? autoTableModule;
    const doc = new jsPDF();

    const margin = 10;

    // Try to load and add logo
    try {
      const logoBlob = await ky.get("/logo_sin_eslogan.png").blob();
      const logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          resolve(reader.result as string);
        });
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
    doc.setFontSize(9);
    doc.text("Resumen de Prestación de Servicios a Honorarios (para emisión de BHE)", margin, 36);
    doc.setFontSize(10);
    doc.text(`Periodo: ${monthLabel}`, margin, 45);

    // Employee info
    doc.text(`Prestador: ${employee.full_name}`, margin, 58);
    doc.text(`RUT: ${employee.person?.rut || "-"}`, margin, 65);

    // Summary table
    const fmtCLP = (n: number) =>
      n.toLocaleString("es-CL", { currency: "CLP", minimumFractionDigits: 0, style: "currency" });

    // Use retention rate from backend summary (already calculated with correct year)
    const retentionPercent = formatRetentionPercent(summaryRow.retentionRate || 0);

    autoTable(doc, {
      body: [
        ["Tiempo total facturable", summaryRow.hoursFormatted],
        ["Tiempo adicional facturable", summaryRow.overtimeFormatted],
        ["Tarifa por hora", fmtCLP(summaryRow.hourlyRate)],
        ["Monto bruto de honorarios", fmtCLP(summaryRow.subtotal)],
        [`Retención (${retentionPercent})`, `-${fmtCLP(summaryRow.retention)}`],
        ["Líquido estimado", fmtCLP(summaryRow.net)],
      ],
      columnStyles: { 1: { halign: "right" } },
      head: [["Concepto", "Valor"]],
      headStyles: { fillColor: [14, 100, 183] },
      margin: { left: margin, right: margin },
      startY: 75,
      styles: { fontSize: 10 },
      theme: "grid",
    });

    // Detail table
    const lastTableRef = doc as unknown as { lastAutoTable?: { finalY: number } };
    const nextY = lastTableRef.lastAutoTable ? lastTableRef.lastAutoTable.finalY + 10 : 120;

    const detailBody = bulkRows
      .filter((row) => row.entrada || row.salida)
      .map((row) => [
        dayjs(row.date).format("DD-MM-YYYY"),
        row.entrada || "-",
        row.salida || "-",
        row.overtime || "-",
      ]);

    if (detailBody.length > 0) {
      autoTable(doc, {
        body: detailBody,
        head: [["Fecha", "Inicio de prestación", "Término de prestación", "Observación"]],
        headStyles: { fillColor: [241, 167, 34], halign: "center" },
        margin: { left: margin, right: margin },
        startY: nextY,
        styles: { fontSize: 9, halign: "center" },
        theme: "grid",
      });
    }

    // Nota de blindaje legal
    const finalTableRef = doc as unknown as { lastAutoTable?: { finalY: number } };
    const noteY = finalTableRef.lastAutoTable
      ? finalTableRef.lastAutoTable.finalY + 10
      : nextY + 50;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const noteText =
      "Nota: Este resumen se emite exclusivamente para fines de respaldo, conciliación y cálculo de honorarios del periodo indicado. Los tramos horarios consignados corresponden a la planificación y coordinación de las prestaciones y no constituyen control de jornada, asistencia ni implican vínculo de subordinación o dependencia.";
    const splitNote = doc.splitTextToSize(noteText, 190);
    doc.text(splitNote, margin, noteY);

    // Convert to base64
    const pdfBlob = doc.output("blob");
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1] || "";
        resolve(base64);
      });
      reader.addEventListener(
        "error",
        () => {
          resolve(null);
        },
        { once: true },
      );
      reader.readAsDataURL(pdfBlob);
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return null;
  }
}
