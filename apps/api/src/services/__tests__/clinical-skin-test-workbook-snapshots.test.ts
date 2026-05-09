import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { extractSkinTestWorkbookSnapshot } from "../clinical-skin-test-workbook-snapshots.ts";

describe("clinical skin test workbook snapshots", () => {
  it("extracts only the first worksheet cells, merges, formulas, notes, and basic style hints", async () => {
    const first: XLSX.WorkSheet = {
      B2: { t: "s", v: "PRICKTEST CUTANEO" },
      A4: { t: "s", v: "RUT:" },
      B4: { t: "s", v: "23.053.128-5" },
      C6: { t: "n", v: 15, f: "SUM(C7:C8)" },
      D6: { t: "d", v: new Date("2022-05-12T00:00:00.000Z"), c: [{ a: "", t: "valor calculado" }] },
      "!ref": "A2:D6",
      "!merges": [{ s: { r: 1, c: 1 }, e: { r: 1, c: 3 } }],
    };
    const second: XLSX.WorkSheet = {
      A1: { t: "s", v: "NO DEBE ENTRAR" },
      "!ref": "A1:A1",
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, first, "Primera");
    XLSX.utils.book_append_sheet(wb, second, "Segunda");
    const buf = Buffer.from(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as ArrayBuffer);

    const snapshot = await extractSkinTestWorkbookSnapshot(buf);

    expect(snapshot.version).toBe(1);
    expect(snapshot.sheet.name).toBe("Primera");
    expect(snapshot.sheet.merges).toEqual([
      { bottom: 2, left: 2, range: "B2:D2", right: 4, top: 2 },
    ]);
    expect(snapshot.sheet.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          a1: "B2",
          r: 2,
          c: 2,
          text: "PRICKTEST CUTANEO",
          type: "string",
        }),
        expect.objectContaining({
          a1: "C6",
          formula: "SUM(C7:C8)",
          result: { kind: "number", value: 15 },
          type: "formula",
        }),
        expect.objectContaining({
          a1: "D6",
          note: "valor calculado",
          raw: { kind: "date", value: "2022-05-12T00:00:00.000Z" },
          type: "date",
        }),
      ])
    );
    expect(snapshot.sheet.cells.some((cell) => cell.text === "NO DEBE ENTRAR")).toBe(false);
  });
});
