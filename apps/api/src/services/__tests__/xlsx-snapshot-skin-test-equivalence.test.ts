import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  parseSkinTestWorkbookBuffer,
  parseSkinTestWorksheet,
} from "../clinical-skin-test-parser.ts";
import { extractXlsxSnapshot, snapshotToWorksheet } from "../xlsx-snapshot.ts";

// Phase D guard: the skin-test reprocess re-parses from the shared OneDrive
// snapshot instead of re-downloading. This only holds if reconstructing a
// worksheet from the snapshot yields the SAME parse as the original buffer.
// The snapshot stores cells as visible text; snapshotToWorksheet rebuilds them
// as string cells (w = text). The parser reads cells solely via getCellText
// (prefers cell.w) + !ref, never merges or numeric types — so the two paths
// must produce identical ParsedSkinTestWorkbook output for every template.

function s(v: string): XLSX.CellObject {
  return { t: "s", v };
}
function n(v: number): XLSX.CellObject {
  return { t: "n", v };
}
function d(v: Date): XLSX.CellObject {
  return { t: "d", v };
}

function makeBuffer(name: string, cells: Record<string, XLSX.CellObject>): Buffer {
  let minR = Infinity,
    maxR = -Infinity,
    minC = Infinity,
    maxC = -Infinity;
  for (const addr of Object.keys(cells)) {
    const { r, c } = XLSX.utils.decode_cell(addr);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  const sheet: XLSX.WorkSheet = { ...cells };
  sheet["!ref"] = XLSX.utils.encode_range({ s: { r: minR, c: minC }, e: { r: maxR, c: maxC } });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, name);
  return Buffer.from(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as ArrayBuffer);
}

async function assertEquivalent(buffer: Buffer) {
  const fromBuffer = await parseSkinTestWorkbookBuffer(buffer);
  const snapshot = await extractXlsxSnapshot(buffer);
  const fromSnapshot = parseSkinTestWorksheet(snapshotToWorksheet(snapshot));
  expect(fromSnapshot).toEqual(fromBuffer);
}

describe("xlsx snapshot ↔ skin-test parser equivalence", () => {
  it("modern P/E multitest (numbers + Excel date + results)", async () => {
    await assertEquivalent(
      makeBuffer("Test", {
        A1: s("MULTITEST CUTANEO"),
        A2: s("Nombre:"),
        B2: s("JUAN PEREZ GONZALEZ"),
        A3: s("RUT:"),
        B3: s("26.813.410-7"),
        A4: s("Fecha:"),
        B4: d(new Date(Date.UTC(2026, 4, 12))),
        A6: s("Alergeno"),
        B6: s("P"),
        C6: s("E"),
        A7: s("D1 Dermatophagoides pteronyssinus"),
        B7: n(5),
        C7: n(8),
        A8: s("Control Positivo"),
        B8: n(6),
        C8: n(7),
        A9: s("Control Negativo"),
        B9: n(0),
        C9: n(0),
      })
    );
  });

  it("textual date + standalone RUT header", async () => {
    await assertEquivalent(
      makeBuffer("Test", {
        A1: s("TEST CUTANEO ALIMENTARIO"),
        A2: s("PACIENTE: MARIA SOTO"),
        A3: s("26.813.410-7"),
        A4: s("12 DE MAYO DEL 2026"),
        A6: s("Alergeno"),
        B6: s("P"),
        C6: s("E"),
        A7: s("F2 Leche de vaca"),
        B7: n(3),
        C7: n(4),
        A8: s("Control Positivo"),
        B8: n(5),
        C8: n(6),
      })
    );
  });
});
