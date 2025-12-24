/**
 * Timesheet PDF Document using @react-pdf/renderer v4.3.1
 *
 * React 19 compatible declarative PDF generation
 *
 * NOTE: @react-pdf/renderer generates static PDFs (not HTML) and cannot use
 * CSS variables or DaisyUI tokens. Hardcoded colors are required and expected.
 */

/* eslint-disable no-restricted-syntax */

import { Document, Page, Text, View, StyleSheet, Image, pdf } from "@react-pdf/renderer";
import dayjs from "dayjs";
import type { BulkRow, TimesheetSummaryRow } from "./types";
import type { Employee } from "@/features/hr/employees/types";

// ============================================================================
// STYLES - Using object spread for conditional styles to avoid type issues
// ============================================================================

const colors = {
  white: "#ffffff",
  background: "#f5f5f5",
  altRow: "#fafafa",
  border: "#e0e0e0",
  textPrimary: "#1a1a1a",
  textSecondary: "#666666",
  textMuted: "#999999",
  primaryBlue: "#0e64b7",
  accentOrange: "#f1a722",
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: colors.white,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 30,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 3,
  },

  // Employee info
  employeeInfo: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: colors.background,
    borderRadius: 4,
  },
  employeeText: {
    fontSize: 10,
    marginBottom: 3,
  },

  // Tables
  table: {
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.primaryBlue,
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderOrange: {
    flexDirection: "row",
    backgroundColor: colors.accentOrange,
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    flex: 1,
    color: colors.white,
    fontWeight: "bold",
    fontSize: 9,
  },
  tableHeaderCellRight: {
    flex: 1,
    color: colors.white,
    fontWeight: "bold",
    fontSize: 9,
    textAlign: "right",
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  tableRowAlt: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.altRow,
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
  },
  tableCellRight: {
    flex: 1,
    fontSize: 9,
    textAlign: "right",
  },
  tableCellBold: {
    flex: 1,
    fontSize: 9,
    fontWeight: "bold",
  },
  tableCellRightBold: {
    flex: 1,
    fontSize: 9,
    textAlign: "right",
    fontWeight: "bold",
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 8,
    color: colors.textMuted,
    textAlign: "center",
  },
});

// ============================================================================
// MAIN DOCUMENT COMPONENT
// ============================================================================

interface TimesheetDocumentProps {
  employee: Employee;
  summaryRow: TimesheetSummaryRow;
  bulkRows: BulkRow[];
  monthLabel: string;
  logoSrc?: string;
}

export function TimesheetDocument({ employee, summaryRow, bulkRows, monthLabel, logoSrc }: TimesheetDocumentProps) {
  const fmtCLP = (n: number) =>
    n.toLocaleString("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    });

  const detailRows = bulkRows.filter((row) => row.entrada || row.salida);

  // Summary data rows
  const summaryData = [
    { label: "Horas trabajadas", value: summaryRow.hoursFormatted, alt: false, bold: false },
    { label: "Horas extras", value: summaryRow.overtimeFormatted, alt: true, bold: false },
    { label: "Tarifa por hora", value: fmtCLP(summaryRow.hourlyRate), alt: false, bold: false },
    { label: "Subtotal", value: fmtCLP(summaryRow.subtotal), alt: true, bold: false },
    { label: "Retención", value: fmtCLP(summaryRow.retention), alt: false, bold: false },
    { label: "Total líquido", value: fmtCLP(summaryRow.net), alt: true, bold: true },
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {logoSrc && <Image src={logoSrc} style={styles.logo} />}
          <Text style={styles.title}>Boleta de Honorarios</Text>
          <Text style={styles.subtitle}>Servicios de {summaryRow.role}</Text>
          <Text style={styles.subtitle}>Periodo: {monthLabel}</Text>
        </View>

        {/* Employee Info */}
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeText}>Prestador: {employee.full_name}</Text>
          <Text style={styles.employeeText}>RUT: {employee.person?.rut || "-"}</Text>
        </View>

        {/* Summary Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Concepto</Text>
            <Text style={styles.tableHeaderCellRight}>Valor</Text>
          </View>
          {summaryData.map((row) => (
            <View key={row.label} style={row.alt ? styles.tableRowAlt : styles.tableRow}>
              <Text style={row.bold ? styles.tableCellBold : styles.tableCell}>{row.label}</Text>
              <Text style={row.bold ? styles.tableCellRightBold : styles.tableCellRight}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* Detail Table */}
        {detailRows.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableHeaderOrange}>
              <Text style={styles.tableHeaderCell}>Fecha</Text>
              <Text style={styles.tableHeaderCell}>Entrada</Text>
              <Text style={styles.tableHeaderCell}>Salida</Text>
              <Text style={styles.tableHeaderCellRight}>Extras</Text>
            </View>
            {detailRows.map((row, idx) => (
              <View key={row.date} style={idx % 2 === 1 ? styles.tableRowAlt : styles.tableRow}>
                <Text style={styles.tableCell}>{dayjs(row.date).format("DD-MM-YYYY")}</Text>
                <Text style={styles.tableCell}>{row.entrada || "-"}</Text>
                <Text style={styles.tableCell}>{row.salida || "-"}</Text>
                <Text style={styles.tableCellRight}>{row.overtime || "-"}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>Documento generado automáticamente el {dayjs().format("DD/MM/YYYY HH:mm")}</Text>
      </Page>
    </Document>
  );
}

// ============================================================================
// PDF GENERATION UTILITIES
// ============================================================================

/**
 * Generates PDF blob from timesheet data
 */
export async function generateTimesheetPdfBlob(
  employee: Employee,
  summaryRow: TimesheetSummaryRow,
  bulkRows: BulkRow[],
  monthLabel: string
): Promise<Blob | null> {
  try {
    // Try to load logo
    let logoSrc: string | undefined;
    try {
      const logoResponse = await fetch("/logo_sin_eslogan.png");
      const logoBlob = await logoResponse.blob();
      logoSrc = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
    } catch {
      console.warn("Could not load logo for PDF");
    }

    const blob = await pdf(
      <TimesheetDocument
        employee={employee}
        summaryRow={summaryRow}
        bulkRows={bulkRows}
        monthLabel={monthLabel}
        logoSrc={logoSrc}
      />
    ).toBlob();

    return blob;
  } catch (err) {
    console.error("Error generating PDF:", err);
    return null;
  }
}

/**
 * Generates PDF as base64 string for email attachment
 */
export async function generateTimesheetPdfBase64(
  employee: Employee,
  summaryRow: TimesheetSummaryRow,
  bulkRows: BulkRow[],
  monthLabel: string
): Promise<string | null> {
  const blob = await generateTimesheetPdfBlob(employee, summaryRow, bulkRows, monthLabel);
  if (!blob) return null;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Downloads PDF directly to user's browser
 */
export async function downloadTimesheetPdf(
  employee: Employee,
  summaryRow: TimesheetSummaryRow,
  bulkRows: BulkRow[],
  monthLabel: string,
  filename?: string
): Promise<boolean> {
  const blob = await generateTimesheetPdfBlob(employee, summaryRow, bulkRows, monthLabel);
  if (!blob) return false;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `boleta_${employee.full_name.replace(/\s+/g, "_")}_${monthLabel}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}
