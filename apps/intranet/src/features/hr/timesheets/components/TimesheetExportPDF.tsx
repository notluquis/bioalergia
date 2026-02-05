import { Checkbox, Popover } from "@heroui/react";
import dayjs from "dayjs";
import type { CellHookData } from "jspdf-autotable";
import React from "react";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { useSettings } from "@/context/SettingsContext";
import type { Employee } from "@/features/hr/employees/types";
import { apiClient } from "@/lib/api-client";
import { fmtCLP } from "@/lib/format";
import { formatRetentionPercent } from "~/shared/retention";

import type { BulkRow, TimesheetSummaryRow } from "../types";

import "dayjs/locale/es";

const MONTH_LABEL_REGEX = /^(\d{4})-(\d{2})$/;
const URL_REGEX = /^https?:\/\//i;
const TIME_HH_MM_REGEX = /^\d{1,2}:\d{2}$/;

type TimesheetColumnKey = "date" | "entrada" | "overtime" | "salida" | "worked";

const assertUnreachable = (value: never): never => {
  throw new Error(`Unhandled column key: ${String(value)}`);
};

interface TimesheetExportPDFProps {
  bulkRows: BulkRow[];
  columns: TimesheetColumnKey[];
  employee: Employee;
  logoUrl: string;
  monthLabel: string;
  summary: null | TimesheetSummaryRow;
}

const COLUMN_LABELS: Record<TimesheetColumnKey, string> = {
  date: "Fecha",
  entrada: "Inicio de prestación",
  overtime: "Observación",
  salida: "Término de prestación",
  worked: "Tiempo facturable",
};

type AutoTableFactory = typeof import("jspdf-autotable");
interface DetailTableProps {
  autoTable: AutoTableFactory["default"];
  bulkRows: BulkRow[];
  defaultCols: readonly TimesheetColumnKey[];
  doc: import("jspdf").default;
  labels: Record<TimesheetColumnKey, string>;
  margin: number;
  pageWidth: number;
  selectedCols: TimesheetColumnKey[];
  startY: number;
}

type JsPdfFactory = typeof import("jspdf");

interface SummaryTableProps {
  autoTable: AutoTableFactory["default"];
  doc: import("jspdf").default;
  infoStartY: number;
  margin: number;
  pageWidth: number;
  summary: null | TimesheetSummaryRow;
}
export function TimesheetExportPDF({
  bulkRows,
  columns,
  employee,
  logoUrl,
  monthLabel,
  summary,
}: TimesheetExportPDFProps) {
  const { settings } = useSettings();
  const defaultCols: readonly TimesheetColumnKey[] = [
    "date",
    "entrada",
    "salida",
    "worked",
    "overtime",
  ];

  const [selectedCols, setSelectedCols] = React.useState<TimesheetColumnKey[]>(
    columns.length > 0 ? columns : [...defaultCols],
  );
  const [showOptions, setShowOptions] = React.useState(false);
  const pdfLibsRef = React.useRef<null | {
    autoTable: AutoTableFactory["default"];
    jsPDF: JsPdfFactory["default"];
  }>(null);

  async function loadPdfLibs() {
    if (!pdfLibsRef.current) {
      const [{ default: jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableModule.default ?? autoTableModule;
      pdfLibsRef.current = { autoTable, jsPDF };
    }
    return pdfLibsRef.current;
  }

  interface JsPdfPageSize {
    getWidth?: () => number;
    width?: number;
  }

  interface JsPdfInternal {
    getPageSize?: () => JsPdfPageSize;
    pageSize?: JsPdfPageSize;
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: pdf generation requires sequential steps
  async function handleExport(preview = true) {
    try {
      const libs = await loadPdfLibs();
      const { autoTable, jsPDF } = libs;
      const doc = new jsPDF();
      const internal = (doc as unknown as { internal?: JsPdfInternal }).internal ?? {};
      const pageSize = internal.pageSize ?? internal.getPageSize?.();
      const pageWidth: number =
        typeof pageSize?.getWidth === "function" ? pageSize.getWidth() : (pageSize?.width ?? 210);
      const margin = 10;

      // Agregar header (logo + título + datos org)
      const { infoStartY } = await addPdfHeader(doc, settings, logoUrl, pageWidth, margin);

      // Agregar info del prestador y periodo
      addPrestadorInfo(doc, employee, monthLabel, summary, pageWidth, margin, infoStartY);

      // Tabla de RESUMEN
      drawSummaryTable({ autoTable, doc, infoStartY, margin, pageWidth, summary });

      // Tabla de DETALLE
      const lastTableReference = doc as unknown as { lastAutoTable?: { finalY: number } };
      const lastAutoTable = lastTableReference.lastAutoTable;
      const nextY = lastAutoTable ? lastAutoTable.finalY + 8 : infoStartY + 30;

      drawDetailTable({
        autoTable,
        bulkRows,
        defaultCols,
        doc,
        labels: COLUMN_LABELS,
        margin,
        pageWidth,
        selectedCols,
        startY: nextY,
      });

      // Nota de blindaje legal
      addLegalNote(doc, pageWidth, margin);

      // Guardar / previsualizar
      const safeName = (employee.full_name || "Trabajador").replaceAll(/[^a-zA-Z0-9_\- ]/g, "");
      if (preview) {
        const pdfDataUri = doc.output("dataurlstring");
        const previewWindow = window.open("", "_blank", "noopener,noreferrer");
        if (previewWindow) {
          previewWindow.opener = null;
          previewWindow.location.href = pdfDataUri;
        } else {
          alert(
            "No se pudo abrir la vista previa. Revisa si el navegador bloqueó las ventanas emergentes.",
          );
        }
      } else {
        doc.save(`Honorarios_${safeName}_${monthLabel}.pdf`);
      }
    } catch (error: unknown) {
      console.error("Export PDF error:", error);
      alert("No se pudo generar el PDF. Revisa la consola para más detalles.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative inline-block">
        <Button
          className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm shadow-md hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-primary/35 focus-visible:outline-offset-2"
          onClick={() => handleExport(true)}
          type="button"
          variant="primary"
        >
          Exportar PDF
        </Button>
        <Popover isOpen={showOptions} onOpenChange={setShowOptions}>
          <Popover.Trigger>
            <Tooltip content="Opciones">
              <Button
                className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-default-200 bg-background text-primary shadow hover:bg-background/90"
                size="sm"
                type="button"
                variant="secondary"
              >
                ⋯
              </Button>
            </Tooltip>
          </Popover.Trigger>
          <Popover.Content
            className="w-64 rounded-xl border border-default-200 bg-background p-0 shadow-xl"
            isNonModal
            offset={8}
            placement="bottom end"
          >
            <Popover.Dialog className="p-3">
              <p className="mb-2 font-semibold text-default-700 text-xs">Columnas del detalle</p>
              <div className="space-y-2">
                {[...defaultCols].map((key) => (
                  <Checkbox
                    key={key}
                    isSelected={selectedCols.includes(key)}
                    onChange={(checked) => {
                      setSelectedCols((prev) => {
                        const set = new Set<TimesheetColumnKey>(prev);
                        if (checked) {
                          set.add(key);
                        } else {
                          set.delete(key);
                        }
                        return [...set];
                      });
                    }}
                  >
                    {COLUMN_LABELS[key] || key}
                  </Checkbox>
                ))}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  className="text-default-500 text-xs"
                  onClick={() => {
                    setShowOptions(false);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Cerrar
                </Button>
                <Button
                  className="text-primary text-xs"
                  onClick={() => handleExport(true)}
                  size="sm"
                  variant="ghost"
                >
                  Vista previa
                </Button>
                <Button
                  className="text-primary text-xs"
                  onClick={() => handleExport(false)}
                  size="sm"
                  variant="ghost"
                >
                  Descargar
                </Button>
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
    </div>
  );
}

// Helper: Cargar logo y normalizarlo a PNG (evitar "wrong PNG signature")
function blobToDataUrl(blob: Blob): Promise<null | string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(reader.result as string);
    });
    reader.addEventListener("error", () => {
      resolve(null);
    });
    reader.readAsDataURL(blob);
  });
}

// === PDF GENERATION HELPERS ===

interface HeaderResult {
  infoStartY: number;
}

async function addPdfHeader(
  doc: import("jspdf").default,
  settings: { logoUrl?: string; orgName?: string; orgAddress?: string; orgPhone?: string },
  logoUrl: string,
  pageWidth: number,
  margin: number,
): Promise<HeaderResult> {
  const resolvedLogo = settings.logoUrl || logoUrl;
  let logoDataUrl: null | string = null;
  if (resolvedLogo) {
    logoDataUrl = await loadLogoAsPng(resolvedLogo);
  }
  if (!logoDataUrl) {
    logoDataUrl = await loadLogoAsPng("/logo.png");
  }

  const headerTopY = margin + 2;
  let logoBottomY = headerTopY;
  const dims = await getLogoDimensions(logoDataUrl);
  if (dims && logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, headerTopY, dims.w, dims.h);
    logoBottomY = headerTopY + dims.h;
  }

  const orgName = settings.orgName || "Bioalergia";
  const orgAddress = settings.orgAddress || "";
  const orgPhone = settings.orgPhone || "";
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Boleta de Honorarios", pageWidth - margin, headerTopY + 2, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Resumen de Prestación de Servicios a Honorarios (para emisión de BHE)",
    pageWidth - margin,
    headerTopY + 7,
    { align: "right" },
  );
  const rightLines = [orgName, orgAddress, orgPhone ? `Tel: ${orgPhone}` : null].filter(
    Boolean,
  ) as string[];
  let rightY = headerTopY + 8;
  for (const line of rightLines) {
    doc.text(line, pageWidth - margin, rightY, { align: "right" });
    rightY += 5;
  }

  return { infoStartY: Math.max(logoBottomY, rightY) + 6 };
}

function addPrestadorInfo(
  doc: import("jspdf").default,
  employee: Employee | null,
  monthLabel: string,
  summary: null | TimesheetSummaryRow,
  pageWidth: number,
  margin: number,
  infoStartY: number,
): void {
  dayjs.locale("es");
  let periodEs = monthLabel;
  const monthMatch = MONTH_LABEL_REGEX.exec(monthLabel);
  if (monthMatch) {
    periodEs = dayjs(`${monthMatch[1]}-${monthMatch[2]}-01`).locale("es").format("MMMM YYYY");
  } else if (dayjs(monthLabel, "MMMM YYYY", "en").isValid()) {
    periodEs = dayjs(monthLabel, "MMMM YYYY", "en").locale("es").format("MMMM YYYY");
  } else if (dayjs(monthLabel, "MMMM YYYY", "es").isValid()) {
    periodEs = dayjs(monthLabel, "MMMM YYYY", "es").locale("es").format("MMMM YYYY");
  }
  periodEs = periodEs.charAt(0).toUpperCase() + periodEs.slice(1);
  const payDateFormatted = summary?.payDate
    ? dayjs(summary.payDate, "YYYY-MM-DD").format("DD-MM-YYYY")
    : null;

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
  doc.text(`Líquido estimado: ${fmtCLP(net)}`, margin, infoStartY + 14);
  doc.setFont("helvetica", "normal");
}

function addLegalNote(doc: import("jspdf").default, pageWidth: number, margin: number): void {
  const finalTableRef = doc as unknown as { lastAutoTable?: { finalY: number } };
  const noteY = finalTableRef.lastAutoTable ? finalTableRef.lastAutoTable.finalY + 10 : 120;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const noteText =
    "Nota: Este resumen se emite exclusivamente para fines de respaldo, conciliación y cálculo de honorarios del periodo indicado. Los tramos horarios consignados corresponden a la planificación y coordinación de las prestaciones y no constituyen control de jornada, asistencia ni implican vínculo de subordinación o dependencia.";
  const splitNote = doc.splitTextToSize(noteText, pageWidth - margin * 2);
  doc.text(splitNote, margin, noteY);
}

// === NEW EXTRACTED HELPERS ===

function computeWorked(entrada?: string, salida?: string): string {
  const s = timeToMinutes(entrada);
  const e = timeToMinutes(salida);
  if (s == null || e == null) {
    return "";
  }
  let diff = e - s;
  if (diff < 0) {
    diff += 24 * 60;
  }
  const hh = String(Math.floor(diff / 60))
    .toString()
    .padStart(2, "0");
  const mm = String(diff % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function drawDetailTable({
  autoTable,
  bulkRows,
  defaultCols,
  doc,
  labels,
  margin,
  pageWidth,
  selectedCols,
  startY,
}: DetailTableProps) {
  const hasAnyOvertime = bulkRows.some(
    (row) => row.overtime && row.overtime !== "0:00" && row.overtime !== "00:00",
  );
  const baseColKeys: TimesheetColumnKey[] =
    selectedCols.length > 0 ? selectedCols : [...defaultCols];
  const colKeys: TimesheetColumnKey[] = hasAnyOvertime
    ? baseColKeys
    : baseColKeys.filter((k) => k !== "overtime");

  const workedRows = bulkRows.filter((row) => row.entrada || row.salida);

  const body = workedRows.map((row) =>
    colKeys.map((key): string => {
      switch (key) {
        case "date": {
          return dayjs(row.date).isValid() ? dayjs(row.date).format("DD-MM-YYYY") : "-";
        }
        case "entrada": {
          return row.entrada || "-";
        }
        case "overtime": {
          return row.overtime || "-";
        }
        case "salida": {
          return row.salida || "-";
        }
        case "worked": {
          return computeWorked(row.entrada, row.salida) || "-";
        }
        default: {
          return assertUnreachable(key);
        }
      }
    }),
  );

  if (body.length === 0) {
    doc.setFontSize(11);
    doc.text("Sin registros para este periodo.", margin, startY);
    return;
  }

  autoTable(doc, {
    body,
    columnStyles: {
      0: { halign: "center" },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
    },
    head: [colKeys.map((k) => labels[k] ?? k.toUpperCase())],
    headStyles: {
      fillColor: [241, 167, 34],
      fontSize: 9,
      fontStyle: "bold",
      textColor: [255, 255, 255],
    },
    margin: { left: margin, right: margin },
    startY,
    styles: { cellPadding: 1, fontSize: 8, overflow: "linebreak" },
    tableWidth: pageWidth - margin * 2,
    theme: "grid",
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

function drawSummaryTable({
  autoTable,
  doc,
  infoStartY,
  margin,
  pageWidth,
  summary,
}: SummaryTableProps) {
  const summaryHead = [["Concepto", "Valor"]];
  const hasOvertime = summary && (summary.overtimeMinutes > 0 || (summary.extraAmount || 0) > 0);

  const summaryBody: string[][] = [];
  if (summary) {
    const retentionPercent = formatRetentionPercent(summary.retentionRate || 0);

    summaryBody.push(
      ["Tiempo total facturable", summary.hoursFormatted || "0:00"],
      ...(hasOvertime
        ? [["Tiempo adicional facturable", summary.overtimeFormatted || "0:00"]]
        : []),
      ["Tarifa por hora", fmtCLP(summary.hourlyRate || 0)],
      ["Monto bruto de honorarios", fmtCLP(summary.subtotal || 0)],
      [`Retención (${retentionPercent})`, `-${fmtCLP(summary.retention || 0)}`],
      ["Líquido estimado", fmtCLP(summary.net || 0)],
    );
  }

  const summaryColumnStyles: Record<string, { halign: "center" | "left" | "right" }> = {
    0: { halign: "left" },
    1: { halign: "right" },
  };

  autoTable(doc, {
    body: summaryBody,
    columnStyles: summaryColumnStyles,
    head: summaryHead,
    headStyles: { fillColor: [14, 100, 183], fontStyle: "bold", textColor: [255, 255, 255] },
    margin: { left: margin, right: margin },
    startY: infoStartY + 20,
    styles: { cellPadding: 2, fontSize: 9, overflow: "linebreak" },
    tableWidth: pageWidth - margin * 2,
    theme: "grid",
  });
}

function getLogoDimensions(logoDataUrl: null | string): Promise<null | { h: number; w: number }> {
  if (!logoDataUrl) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.addEventListener("load", () => {
      const maxW = 45;
      const maxH = 22;
      const iw0 = img.width || maxW;
      const ih0 = img.height || maxH;
      const scale = Math.min(maxW / iw0, maxH / ih0);
      resolve({ h: Math.max(1, ih0 * scale), w: Math.max(1, iw0 * scale) });
    });
    img.addEventListener("error", () => {
      resolve(null);
    });
    img.src = logoDataUrl;
  });
}

function imageToPngDataUrl(objectUrl: string): Promise<null | string> {
  return new Promise((resolve) => {
    const img = new Image();
    const onLoad = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width || 240;
        canvas.height = img.height || 120;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.addEventListener("load", onLoad);
    img.addEventListener("error", () => {
      resolve(null);
    });
    img.src = objectUrl;
  });
}

// Helper: Cargar logo y normalizarlo a PNG (evitar "wrong PNG signature")
async function loadLogoAsPng(url: string): Promise<null | string> {
  try {
    let blob: Blob | null = null;
    const isUrl = URL_REGEX.test(url);

    if (isUrl) {
      try {
        const proxyUrl = `/api/assets/proxy-image?url=${encodeURIComponent(url)}`;
        blob = await apiClient.getRaw<Blob>(proxyUrl, { responseType: "blob" });
      } catch {
        blob = null;
      }
    }

    if (!blob) {
      try {
        blob = await apiClient.getRaw<Blob>(url, { responseType: "blob" });
      } catch {
        blob = null;
      }
    }

    if (!blob) {
      return null;
    }

    if (blob.type === "image/png") {
      return blobToDataUrl(blob);
    }

    const objectUrl = URL.createObjectURL(blob);
    try {
      return await imageToPngDataUrl(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

// === MAIN COMPONENT ===

function timeToMinutes(t?: string): null | number {
  if (!t || !TIME_HH_MM_REGEX.test(t)) {
    return null;
  }
  const parts = t.split(":").map(Number);
  const [h, m] = parts;
  if (h === undefined || m === undefined) {
    return null;
  }
  if (h < 0 || h > 23 || m < 0 || m >= 60) {
    return null;
  }
  return h * 60 + m;
}
