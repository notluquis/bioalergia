import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { extractSkinTestWorkbookSnapshot } from "../clinical-skin-test-workbook-snapshots";

describe("clinical skin test workbook snapshots", () => {
  it("extracts only the first worksheet cells, merges, formulas, notes, and basic style hints", async () => {
    const workbook = new ExcelJS.Workbook();
    const first = workbook.addWorksheet("Primera");
    const second = workbook.addWorksheet("Segunda");

    first.mergeCells("B2:D2");
    first.getCell("B2").value = "PRICKTEST CUTANEO";
    first.getCell("B2").font = { bold: true, color: { argb: "FF1F4E79" }, size: 18 };
    first.getCell("B2").alignment = { horizontal: "center" };
    first.getCell("A4").value = "RUT:";
    first.getCell("B4").value = "23.053.128-5";
    first.getCell("C6").value = { formula: "SUM(C7:C8)", result: 15 };
    first.getCell("D6").note = "valor calculado";
    first.getCell("D6").value = new Date("2022-05-12T00:00:00.000Z");
    second.getCell("A1").value = "NO DEBE ENTRAR";

    const snapshot = await extractSkinTestWorkbookSnapshot(await workbook.xlsx.writeBuffer());

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
          style: expect.objectContaining({
            alignment: { horizontal: "center" },
            font: expect.objectContaining({ bold: true, color: "FF1F4E79", size: 18 }),
          }),
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
