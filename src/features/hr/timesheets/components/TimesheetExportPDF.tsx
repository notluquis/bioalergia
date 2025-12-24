/**
 * Timesheet Export PDF Component
 *
 * UI component for exporting timesheet PDFs using @react-pdf/renderer
 * Provides preview and download options
 */

import { useState, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import Button from "@/components/ui/Button";
import type { Employee } from "@/features/hr/employees/types";
import type { BulkRow, TimesheetSummaryRow } from "../types";
import { TimesheetDocument } from "../TimesheetPDF";

interface TimesheetExportPDFProps {
  logoUrl: string;
  employee: Employee;
  summary: TimesheetSummaryRow | null;
  bulkRows: BulkRow[];
  columns: string[];
  monthLabel: string;
}

export default function TimesheetExportPDF({ employee, summary, bulkRows, monthLabel }: TimesheetExportPDFProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * Load logo as base64 data URL
   */
  const loadLogo = useCallback(async (): Promise<string | undefined> => {
    try {
      const logoResponse = await fetch("/logo_sin_eslogan.png");
      const logoBlob = await logoResponse.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
    } catch {
      console.warn("Could not load logo for PDF");
      return undefined;
    }
  }, []);

  /**
   * Handle PDF export - preview in new tab or download
   */
  const handleExport = useCallback(
    async (preview = true) => {
      if (!summary) return;

      setIsGenerating(true);

      try {
        const logoSrc = await loadLogo();

        const blob = await pdf(
          <TimesheetDocument
            employee={employee}
            summaryRow={summary}
            bulkRows={bulkRows}
            monthLabel={monthLabel}
            logoSrc={logoSrc}
          />
        ).toBlob();

        if (preview) {
          // Open in new tab for preview
          const blobUrl = URL.createObjectURL(blob);
          const previewWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");
          if (!previewWindow) {
            alert("No se pudo abrir la vista previa. Revisa si el navegador bloqueó las ventanas emergentes.");
          } else {
            // Clean up after a delay
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
          }
        } else {
          // Download directly
          const safeName = (employee.full_name || "Trabajador").replace(/[^a-zA-Z0-9_\- ]/g, "");
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `Honorarios_${safeName}_${monthLabel}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        console.error("Export PDF error:", err);
        alert("No se pudo generar el PDF. Revisa la consola para más detalles.");
      } finally {
        setIsGenerating(false);
      }
    },
    [employee, summary, bulkRows, monthLabel, loadLogo]
  );

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="primary"
        className="text-primary-content bg-primary hover:bg-primary/85 focus-visible:outline-primary/35 rounded-xl px-4 py-2 text-sm font-semibold shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => handleExport(true)}
        disabled={!summary || isGenerating}
      >
        {isGenerating ? "Generando..." : "Exportar PDF"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="border-base-300 bg-base-100 text-primary hover:bg-base-100/90 ml-1 inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow"
        title="Descargar"
        onClick={() => handleExport(false)}
        disabled={!summary || isGenerating}
      >
        ⬇
      </Button>
    </div>
  );
}
