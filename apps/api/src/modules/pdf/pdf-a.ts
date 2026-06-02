// Post-procesa un PDF (pdf-lib) a PDF/A-3 con Ghostscript: agrega el
// OutputIntent sRGB + XMP de conformidad que pdf-lib no emite. Golden 2026 para
// documentos archivables/legales (certificados, cotizaciones, presupuestos).
//
// Requiere el binario `gs` (Dockerfile: apt-get install ghostscript) + el perfil
// sRGB versionado en assets/pdf/srgb.icc. Si gs no está o falla, devuelve el PDF
// original (degradación segura — sigue siendo válido, sólo sin conformidad A/3).
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ASSETS_DIR = path.resolve(import.meta.dirname, "../../../assets");
const ICC_PATH = path.join(ASSETS_DIR, "pdf", "srgb.icc");
const GS_BIN = process.env.GHOSTSCRIPT_BIN || "gs";

function pdfaDefPs(iccPath: string, title: string): string {
  // pdfmark que define el OutputIntent sRGB (requisito PDF/A). El título va al
  // DOCINFO. Escapamos paréntesis del título (sintaxis PostScript).
  const safeTitle = title.replace(/([()\\])/g, "\\$1");
  return `%!
[ /Title (${safeTitle}) /DOCINFO pdfmark
[/_objdef {icc_PDFA} /type /stream /OBJ pdfmark
[{icc_PDFA} <</N 3>> /PUT pdfmark
[{icc_PDFA} (${iccPath}) (r) file /PUT pdfmark
[/_objdef {OutputIntent_PDFA} /type /dict /OBJ pdfmark
[{OutputIntent_PDFA} << /Type /OutputIntent /S /GTS_PDFA1 /DestOutputProfile {icc_PDFA} /OutputConditionIdentifier (sRGB) /Info (sRGB IEC61966-2.1) >> /PUT pdfmark
[{Catalog} <</OutputIntents [ {OutputIntent_PDFA} ]>> /PUT pdfmark
`;
}

/**
 * Convierte `pdfBytes` a PDF/A-3 (sRGB). Devuelve los bytes convertidos, o los
 * originales si Ghostscript no está disponible o la conversión falla.
 */
export async function toPdfA3(pdfBytes: Uint8Array, title = "Documento"): Promise<Uint8Array> {
  const stamp = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const dir = os.tmpdir();
  const inPath = path.join(dir, `pdfa-in-${stamp}.pdf`);
  const defPath = path.join(dir, `pdfa-def-${stamp}.ps`);
  const outPath = path.join(dir, `pdfa-out-${stamp}.pdf`);

  try {
    await fs.writeFile(inPath, Buffer.from(pdfBytes));
    await fs.writeFile(defPath, pdfaDefPs(ICC_PATH, title));

    await execFileAsync(
      GS_BIN,
      [
        `--permit-file-read=${ICC_PATH}`,
        "-dPDFA=3",
        "-dBATCH",
        "-dNOPAUSE",
        "-dNOOUTERSAVE",
        "-sColorConversionStrategy=RGB",
        "-sDEVICE=pdfwrite",
        "-dPDFACompatibilityPolicy=1",
        `-sOutputFile=${outPath}`,
        defPath,
        inPath,
      ],
      { timeout: 30_000, maxBuffer: 64 * 1024 * 1024 }
    );

    const out = await fs.readFile(outPath);
    if (out.length < 1000) throw new Error("salida vacía");
    return new Uint8Array(out);
  } catch (error) {
    console.warn(
      "[pdf-a] conversión PDF/A-3 omitida:",
      error instanceof Error ? error.message : error
    );
    return pdfBytes;
  } finally {
    await Promise.all([
      fs.rm(inPath, { force: true }),
      fs.rm(defPath, { force: true }),
      fs.rm(outPath, { force: true }),
    ]).catch(() => undefined);
  }
}
