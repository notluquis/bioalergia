import "dayjs/locale/es";

import { formatRetentionPercent, getEffectiveRetentionRate } from "@shared/retention";
import dayjs from "dayjs";
import type { CellHookData } from "jspdf-autotable";
import React from "react";

import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { useSettings } from "@/context/SettingsContext";
import type { Employee } from "@/features/hr/employees/types";
import { fmtCLP } from "@/lib/format";

import type { BulkRow, TimesheetSummaryRow } from "../types";

type TimesheetColumnKey = "date" | "entrada" | "salida" | "worked" | "overtime";

const assertUnreachable = (value: never): never => {
  throw new Error(`Unhandled column key: ${String(value)}`);
};

interface TimesheetExportPDFProps {
  logoUrl: string;
  employee: Employee;
  summary: TimesheetSummaryRow | null;
  bulkRows: BulkRow[];
  columns: TimesheetColumnKey[];
  month: string; // YYYY-MM format
  monthLabel: string;
}

type JsPdfFactory = typeof import("jspdf");
type AutoTableFactory = typeof import("jspdf-autotable");

export default function TimesheetExportPDF({
  logoUrl,
  employee,
  summary,
  bulkRows,
  columns,
  month,
  monthLabel,
}: TimesheetExportPDFProps) {
  const { settings } = useSettings();
  const defaultCols: readonly TimesheetColumnKey[] = ["date", "entrada", "salida", "worked", "overtime"];
  const [selectedCols, setSelectedCols] = React.useState<TimesheetColumnKey[]>(
    columns.length ? columns : Array.from(defaultCols)
  );
  const [showOptions, setShowOptions] = React.useState(false);
  const pdfLibsRef = React.useRef<{ jsPDF: JsPdfFactory["default"]; autoTable: AutoTableFactory["default"] } | null>(
    null
  );

  async function loadPdfLibs() {
    if (!pdfLibsRef.current) {
      const [{ default: jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = (autoTableModule.default ?? autoTableModule) as AutoTableFactory["default"];
      pdfLibsRef.current = { jsPDF, autoTable };
    }
    return pdfLibsRef.current;
  }

  type JsPdfPageSize = {
    getWidth?: () => number;
    width?: number;
  };

  type JsPdfInternal = {
    pageSize?: JsPdfPageSize;
    getPageSize?: () => JsPdfPageSize;
  };

  async function handleExport(preview = true) {
    try {
      const libs = await loadPdfLibs();
      const { jsPDF, autoTable } = libs;
      const doc = new jsPDF();
      const internal = (doc as unknown as { internal?: JsPdfInternal }).internal ?? {};
      const pageSize = internal.pageSize ?? internal.getPageSize?.();
      const pageWidth: number =
        typeof pageSize?.getWidth === "function" ? pageSize.getWidth() : (pageSize?.width ?? 210);
      const margin = 10;

      // Helper: Cargar logo y normalizarlo a PNG (evitar "wrong PNG signature")
      async function loadLogoAsPng(url: string): Promise<string | null> {
        try {
          let res: Response | null = null;
          if (/^https?:\/\//i.test(url)) {
            const proxyUrl = `/api/assets/proxy-image?url=${encodeURIComponent(url)}`;
            res = await fetch(proxyUrl, { credentials: "include", cache: "no-cache" });
            if (!res.ok) res = null;
          }
          if (!res) {
            res = await fetch(url, { cache: "no-cache" });
          }
          if (!res.ok) return null;
          const blob = await res.blob();
          if (blob.type === "image/png") {
            return await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(blob);
            });
          }
          const objectUrl = URL.createObjectURL(blob);
          try {
            const dataUrl = await new Promise<string | null>((resolve) => {
              const img = new Image();
              img.onload = () => {
                try {
                  const canvas = document.createElement("canvas");
                  canvas.width = img.width || 240;
                  canvas.height = img.height || 120;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) return resolve(null);
                  ctx.drawImage(img, 0, 0);
                  const pngDataUrl = canvas.toDataURL("image/png");
                  resolve(pngDataUrl);
                } catch {
                  resolve(null);
                }
              };
              img.onerror = () => resolve(null);
              img.src = objectUrl;
            });
            return dataUrl;
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        } catch {
          return null;
        }
      }

      // Logo (mantener proporción)
      const resolvedLogo = settings.logoUrl || logoUrl;
      let logoDataUrl: string | null = null;
      if (resolvedLogo) logoDataUrl = await loadLogoAsPng(resolvedLogo);
      if (!logoDataUrl) logoDataUrl = await loadLogoAsPng("/logo.png");

      const headerTopY = margin + 2;
      let logoBottomY = headerTopY;
      if (logoDataUrl) {
        const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const maxW = 45;
            const maxH = 22;
            const iw0 = (img as HTMLImageElement).width || maxW;
            const ih0 = (img as HTMLImageElement).height || maxH;
            const scale = Math.min(maxW / iw0, maxH / ih0);
            resolve({ w: Math.max(1, iw0 * scale), h: Math.max(1, ih0 * scale) });
          };
          img.onerror = () => resolve(null);
          img.src = logoDataUrl!;
        });
        const w = dims?.w ?? 40;
        const h = dims?.h ?? 20;
        doc.addImage(logoDataUrl, "PNG", margin, headerTopY, w, h);
        logoBottomY = headerTopY + h;
      }

      // Encabezado a la derecha (título + datos organización)
      const orgName = settings.orgName || "Bioalergia";
      const orgAddress = settings.orgAddress || "";
      const orgPhone = settings.orgPhone || "";
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Honorarios por servicios prestados", pageWidth - margin, headerTopY + 2, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const rightLines = [orgName, orgAddress, orgPhone ? `Tel: ${orgPhone}` : null].filter(Boolean) as string[];
      let rightY = headerTopY + 8;
      for (const line of rightLines) {
        doc.text(line, pageWidth - margin, rightY, { align: "right" });
        rightY += 5;
      }

      // Info de trabajador y periodo - forzar español
      dayjs.locale("es");
      // monthLabel puede venir como "November 2025" o "2025-11", convertir a español
      let periodEs = monthLabel;
      const monthMatch = monthLabel.match(/^(\d{4})-(\d{2})$/);
      if (monthMatch) {
        // Formato YYYY-MM
        periodEs = dayjs(`${monthMatch[1]}-${monthMatch[2]}-01`).locale("es").format("MMMM YYYY");
      } else if (dayjs(monthLabel, "MMMM YYYY", "en").isValid()) {
        // Formato inglés "November 2025"
        periodEs = dayjs(monthLabel, "MMMM YYYY", "en").locale("es").format("MMMM YYYY");
      } else if (dayjs(monthLabel, "MMMM YYYY", "es").isValid()) {
        // Ya está en español
        periodEs = dayjs(monthLabel, "MMMM YYYY", "es").locale("es").format("MMMM YYYY");
      }
      // Capitalizar primera letra
      periodEs = periodEs.charAt(0).toUpperCase() + periodEs.slice(1);
      // Usar payDate del summary (ya calculado en el backend) en lugar de recalcular
      const payDateFormatted = summary?.payDate ? dayjs(summary.payDate).format("DD-MM-YYYY") : null;
      const infoStartY = Math.max(logoBottomY, rightY) + 6;
      doc.setFontSize(10);
      doc.text(`Prestador: ${employee?.full_name || "-"}`, margin, infoStartY);
      doc.text(`RUT: ${employee?.person?.rut || "-"}`, margin, infoStartY + 6);
      doc.text(`Periodo: ${periodEs}`, pageWidth - margin, infoStartY, { align: "right" });
      if (payDateFormatted) {
        doc.text(`Fecha de pago: ${payDateFormatted}`, pageWidth - margin, infoStartY + 6, {
          align: "right",
        });
      }
      const net = typeof summary?.net === "number" ? summary.net : 0;
      doc.setFont("helvetica", "bold");
      doc.text(`Total líquido: ${fmtCLP(net)}`, margin, infoStartY + 14);
      doc.setFont("helvetica", "normal");

      // Tabla de RESUMEN - formato vertical simple
      const summaryHead = [["Concepto", "Valor"]];
      const hasOvertime = summary && (summary.overtimeMinutes > 0 || (summary.extraAmount || 0) > 0);

      const summaryBody: string[][] = [];
      if (summary) {
        // Extract year from month in YYYY-MM format
        const summaryYear = month ? parseInt(month.split("-")[0]!, 10) : new Date().getFullYear();
        // Handle both camelCase and snake_case from backend
        const summaryData = summary as unknown as Record<string, unknown>;
        const employeeRate =
          (summaryData.retentionRate as number | null) || (summaryData.retention_rate as number | null) || null;
        const effectiveRate = getEffectiveRetentionRate(employeeRate, summaryYear);
        const retentionPercent = formatRetentionPercent(effectiveRate);

        summaryBody.push(["Horas trabajadas", summary.hoursFormatted || "0:00"]);
        if (hasOvertime) {
          summaryBody.push(["Horas extras", summary.overtimeFormatted || "0:00"]);
        }
        summaryBody.push(["Tarifa por hora", fmtCLP(summary.hourlyRate || 0)]);
        summaryBody.push(["Subtotal", fmtCLP(summary.subtotal || 0)]);
        summaryBody.push([`Retención (${retentionPercent})`, `-${fmtCLP(summary.retention || 0)}`]);
        summaryBody.push(["Total Líquido", fmtCLP(summary.net || 0)]);
      }

      const summaryColumnStyles: Record<string, { halign: "left" | "center" | "right" }> = {
        0: { halign: "left" },
        1: { halign: "right" },
      };

      autoTable(doc, {
        head: summaryHead,
        body: summaryBody,
        startY: infoStartY + 20,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [14, 100, 183], textColor: [255, 255, 255], fontStyle: "bold" },
        tableWidth: pageWidth - margin * 2,
        margin: { left: margin, right: margin },
        columnStyles: summaryColumnStyles,
      });

      // Definición de columnas y etiquetas para DETALLE
      // Si no hay overtime en ningún registro, ocultar esa columna
      const hasAnyOvertime = bulkRows.some(
        (row) => row.overtime && row.overtime !== "0:00" && row.overtime !== "00:00"
      );
      // Filtrar columna worked también si no está seleccionada
      const baseColKeys: TimesheetColumnKey[] = selectedCols.length ? selectedCols : Array.from(defaultCols);
      // Ocultar columna overtime si no hay horas extras en ningún día
      const colKeys: TimesheetColumnKey[] = hasAnyOvertime ? baseColKeys : baseColKeys.filter((k) => k !== "overtime");

      const labels: Record<TimesheetColumnKey, string> = {
        date: "Fecha",
        entrada: "Entrada",
        salida: "Salida",
        worked: "Trabajadas",
        overtime: "Extras",
      };

      function timeToMinutes(t?: string): number | null {
        if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
        const parts = t.split(":").map(Number);

        const [h, m] = parts;

        if (h === undefined || m === undefined) return null;
        if (h < 0 || h > 23 || m < 0 || m >= 60) return null;
        return h * 60 + m;
      }
      function computeWorked(entrada?: string, salida?: string): string {
        const s = timeToMinutes(entrada);
        const e = timeToMinutes(salida);
        if (s == null || e == null) return "";
        let diff = e - s;
        if (diff < 0) diff += 24 * 60;
        const hh = String(Math.floor(diff / 60))
          .toString()
          .padStart(2, "0");
        const mm = String(diff % 60).padStart(2, "0");
        return `${hh}:${mm}`;
      }

      // Filtrar solo días con entrada o salida registrada
      const workedRows = bulkRows.filter((row) => row.entrada || row.salida);

      const body = workedRows.map((row) =>
        colKeys.map((key): string => {
          switch (key) {
            case "date":
              return dayjs(row.date).isValid() ? dayjs(row.date).format("DD-MM-YYYY") : row.date;
            case "entrada":
              return row.entrada || "-";
            case "salida":
              return row.salida || "-";
            case "worked":
              return computeWorked(row.entrada, row.salida) || "-";
            case "overtime":
              return row.overtime || "-";
            default:
              return assertUnreachable(key);
          }
        })
      );

      // Tabla de DETALLE en la misma página, después del resumen
      const lastTableReference = doc as unknown as { lastAutoTable?: { finalY: number } };
      const lastAutoTable = lastTableReference.lastAutoTable;
      const nextY = lastAutoTable ? lastAutoTable.finalY + 8 : infoStartY + 30;
      if (!body.length) {
        doc.setFontSize(11);
        doc.text("Sin registros para este periodo.", margin, nextY);
      } else {
        autoTable(doc, {
          head: [colKeys.map((k) => labels[k] ?? k.toUpperCase())],
          body,
          startY: nextY,
          theme: "grid",
          tableWidth: pageWidth - margin * 2,
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 1, overflow: "linebreak" },
          headStyles: { fontSize: 9, fillColor: [241, 167, 34], textColor: [255, 255, 255], fontStyle: "bold" },
          columnStyles: {
            0: { halign: "center" }, // Fecha
            1: { halign: "center" }, // Entrada
            2: { halign: "center" }, // Salida
            3: { halign: "center" }, // Trabajadas
            4: { halign: "center" }, // Extras
          },
          willDrawCell: (data: CellHookData) => {
            if (data.section === "body") {
              const rowIndex = data.row.index;
              const rawDate = workedRows[rowIndex]?.date;
              const isSunday = rawDate && dayjs(rawDate).day() === 0;
              if (isSunday) {
                data.cell.styles.fillColor = [245, 245, 245];
              }
            }
          },
        });
      }

      // Guardar / previsualizar
      const safeName = (employee.full_name || "Trabajador").replace(/[^a-zA-Z0-9_\- ]/g, "");
      if (preview) {
        const blob = doc.output("blob");
        const blobUrl = URL.createObjectURL(blob);
        const previewWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");
        if (!previewWindow) {
          alert("No se pudo abrir la vista previa. Revisa si el navegador bloqueó las ventanas emergentes.");
        } else {
          previewWindow.opener = null;
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        }
      } else {
        doc.save(`Honorarios_${safeName}_${monthLabel}.pdf`);
      }
    } catch (err: unknown) {
      console.error("Export PDF error:", err);
      alert("No se pudo generar el PDF. Revisa la consola para más detalles.");
    }
  }
  return (
    <div className="flex items-center gap-2">
      <div className="relative inline-block">
        <Button
          type="button"
          variant="primary"
          className="text-primary-content bg-primary hover:bg-primary/85 focus-visible:outline-primary/35 rounded-xl px-4 py-2 text-sm font-semibold shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => handleExport(true)}
        >
          Exportar PDF
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="border-base-300 bg-base-100 text-primary hover:bg-base-100/90 ml-1 inline-flex h-9 w-9 items-center justify-center rounded-xl border shadow"
          title="Opciones"
          onClick={() => setShowOptions((v) => !v)}
        >
          ⋯
        </Button>
        {showOptions && (
          <div className="bg-base-100 absolute right-0 z-20 mt-2 w-56 rounded-xl p-3 shadow-xl ring-1 ring-black/5">
            <p className="text-base-content/80 mb-2 text-xs font-semibold">Columnas del detalle</p>
            {Array.from(defaultCols).map((key) => (
              <label key={key} className="text-base-content mb-1 flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedCols.includes(key)}
                  onChange={(e) => {
                    setSelectedCols((prev) => {
                      const set = new Set<TimesheetColumnKey>(prev);
                      if (e.target.checked) set.add(key);
                      else set.delete(key);
                      return Array.from(set);
                    });
                  }}
                />
                {key === "date"
                  ? "Fecha"
                  : key === "entrada"
                    ? "Entrada"
                    : key === "salida"
                      ? "Salida"
                      : key === "worked"
                        ? "Trabajadas"
                        : "Extras"}
              </label>
            ))}
            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="text-base-content/60 hover:text-base-content text-xs"
                onClick={() => setShowOptions(false)}
              >
                Cerrar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="text-primary text-xs hover:underline"
                onClick={() => handleExport(true)}
              >
                Vista previa
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="text-primary text-xs hover:underline"
                onClick={() => handleExport(false)}
              >
                Descargar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
