/**
 * `toPdfA3` — post-proceso PDF/A-3 con Ghostscript. Verifica que devuelve un
 * PDF válido: si gs está (entorno con ghostscript) convierte y agrega el
 * OutputIntent; si no, degrada al original. Ambos casos = PDF válido.
 */
import { PDFDocument, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { toPdfA3 } from "./pdf-a.ts";

async function samplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  page.drawRectangle({ x: 20, y: 20, width: 260, height: 260, color: rgb(0.1, 0.4, 0.6) });
  return doc.save();
}

describe("toPdfA3", () => {
  it("devuelve un PDF válido (convertido a A/3 o fallback)", async () => {
    const out = await toPdfA3(await samplePdf(), "Test");
    expect(Buffer.from(out.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    expect(out.length).toBeGreaterThan(500);
  });

  it("no rompe con título que tiene paréntesis", async () => {
    const out = await toPdfA3(await samplePdf(), "Cotización (N° 46)");
    expect(Buffer.from(out.slice(0, 5)).toString("latin1")).toBe("%PDF-");
  });
});
