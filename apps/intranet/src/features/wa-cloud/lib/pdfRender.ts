// Client-side PDF rendering via pdf.js (pdfjs-dist). Lazy-loaded so the heavy
// library + worker stay out of the main bundle and only download when a PDF
// document tile actually renders. Browsers have no native PDF→image API
// (PDFium isn't exposed to JS), so pdf.js is the standard path.

import type * as PdfjsNs from "pdfjs-dist";

type PdfjsModule = typeof PdfjsNs;

let pdfjsPromise: Promise<PdfjsModule> | null = null;
async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      // Vite resolves `?url` to the emitted worker asset URL (served same-origin).
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export type PdfRenderResult = {
  /** First page rendered as a webp data URL, for the message tile thumbnail. */
  dataUrl: string;
  pageCount: number;
  sizeBytes: number;
};

// Fetch the PDF once (through the auth-gated media proxy → credentials), then
// render page 1 to a webp data URL and read its page count + byte size. One
// download covers thumbnail + metadata.
export async function renderPdfFirstPage(url: string, maxWidth = 320): Promise<PdfRenderResult> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`pdf fetch ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const sizeBytes = bytes.byteLength;

  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: bytes });
  const doc = await task.promise;
  try {
    const pageCount = doc.numPages;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/webp", 0.72);
    return { dataUrl, pageCount, sizeBytes };
  } finally {
    void task.destroy();
  }
}

// "1,2 MB" / "120 KB" — Spanish-locale byte size for the document tile.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}
