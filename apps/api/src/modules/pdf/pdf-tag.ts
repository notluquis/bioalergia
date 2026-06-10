// PDF/UA tagging para pdf-lib (que no taggea nativo). Construye marked content
// (BDC/EMC) alrededor del contenido real + un StructTreeRoot con StructElems,
// ParentTree y MarkInfo. Esto hace el PDF accesible (lectores de pantalla leen
// estructura + orden de lectura), requisito golden 2026 / PDF/UA.
//
// Uso:
//   const tagger = new PdfTagger(pdfDoc);
//   tagger.tag(page, pageIndex, "H1", () => page.drawText("Título", ...));
//   tagger.artifact(page, () => page.drawRectangle(...)); // decorativo
//   tagger.figure(page, pageIndex, "Logo Bioalergia", () => page.drawImage(...));
//   tagger.finalize();  // ANTES de pdfDoc.save()
import fs from "node:fs";
import path from "node:path";
import {
  type PDFDocument,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  type PDFPage,
  type PDFRef,
  PDFString,
} from "pdf-lib";

type StructEntry = { type: string; pageIndex: number; mcid: number; alt?: string };

export class PdfTagger {
  private readonly entries: StructEntry[] = [];
  private readonly mcidByPage = new Map<number, number>();
  private readonly pdfDoc: PDFDocument;

  constructor(pdfDoc: PDFDocument) {
    this.pdfDoc = pdfDoc;
  }

  private nextMcid(pageIndex: number): number {
    const next = this.mcidByPage.get(pageIndex) ?? 0;
    this.mcidByPage.set(pageIndex, next + 1);
    return next;
  }

  /** Envuelve un dibujo de CONTENIDO en una secuencia marcada (BDC/EMC) + lo
   *  registra como StructElem del tipo dado (H1, P, Lbl, Figure, …). */
  tag(page: PDFPage, pageIndex: number, type: string, draw: () => void, alt?: string): void {
    const mcid = this.nextMcid(pageIndex);
    const props = this.pdfDoc.context.obj({ MCID: mcid });
    // ORDEN: BDC primero → draw escribe en el stream → EMC. Secuencial, no spread
    // (el draw de pdf-lib escribe directo sobre el content stream de la página).
    page.pushOperators(
      PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of(type), props as never])
    );
    draw();
    page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent, []));
    this.entries.push({ type, pageIndex, mcid, alt });
  }

  /** Imagen con texto alternativo (Figure + /Alt) — requisito PDF/UA. */
  figure(page: PDFPage, pageIndex: number, alt: string, draw: () => void): void {
    this.tag(page, pageIndex, "Figure", draw, alt);
  }

  /** Variante para dibujos ASÍNCRONOS (p. ej. embeber imágenes): abre la
   *  secuencia marcada, devuelve un cierre que registra el StructElem + EMC.
   *  Uso: const end = tagger.beginTag(page, idx, "Figure", "alt"); await draw(); end(); */
  beginTag(page: PDFPage, pageIndex: number, type: string, alt?: string): () => void {
    const mcid = this.nextMcid(pageIndex);
    const props = this.pdfDoc.context.obj({ MCID: mcid });
    page.pushOperators(
      PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [PDFName.of(type), props as never])
    );
    return () => {
      page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent, []));
      this.entries.push({ type, pageIndex, mcid, alt });
    };
  }

  /** Contenido DECORATIVO (rectángulos, líneas, marcas de agua, fondos): se
   *  marca como Artifact para que el lector de pantalla lo IGNORE. */
  artifact(page: PDFPage, draw: () => void): void {
    page.pushOperators(
      PDFOperator.of(PDFOperatorNames.BeginMarkedContent, [PDFName.of("Artifact")])
    );
    draw();
    page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent, []));
  }

  /** Árbol de estructura + ParentTree + MarkInfo. Llamar ANTES de pdfDoc.save().
   *  Estructura: StructTreeRoot → Document → [H1, P, Figure, …] en orden. */
  finalize(): void {
    const ctx = this.pdfDoc.context;
    const pages = this.pdfDoc.getPages();
    if (this.entries.length === 0) return;

    const structTreeRootRef = ctx.nextRef();
    const documentRef = ctx.nextRef();

    const elemRefs = this.entries.map((entry) => {
      const fields: Record<string, unknown> = {
        Type: "StructElem",
        S: PDFName.of(entry.type),
        P: documentRef,
        Pg: pages[entry.pageIndex].ref,
        K: entry.mcid,
      };
      if (entry.alt) fields.Alt = PDFString.of(entry.alt);
      return ctx.register(ctx.obj(fields as never));
    });

    ctx.assign(
      documentRef,
      ctx.obj({
        Type: "StructElem",
        S: PDFName.of("Document"),
        P: structTreeRootRef,
        K: elemRefs,
      })
    );

    const nums: (PDFNumber | PDFRef)[] = [];
    pages.forEach((page, pageIndex) => {
      const onPage = this.entries
        .map((entry, idx) => ({ entry, ref: elemRefs[idx] }))
        .filter((x) => x.entry.pageIndex === pageIndex)
        .sort((a, b) => a.entry.mcid - b.entry.mcid);
      if (onPage.length === 0) return;
      const arrRef = ctx.register(ctx.obj(onPage.map((x) => x.ref)));
      nums.push(PDFNumber.of(pageIndex), arrRef);
      page.node.set(PDFName.of("StructParents"), PDFNumber.of(pageIndex));
    });
    const parentTreeRef = ctx.register(ctx.obj({ Nums: nums }));

    ctx.assign(
      structTreeRootRef,
      ctx.obj({
        Type: "StructTreeRoot",
        K: documentRef,
        ParentTree: parentTreeRef,
        ParentTreeNextKey: pages.length,
      })
    );

    this.pdfDoc.catalog.set(PDFName.of("StructTreeRoot"), structTreeRootRef);
    this.pdfDoc.catalog.set(PDFName.of("MarkInfo"), ctx.obj({ Marked: true }));
  }
}

const ASSETS_DIR = path.resolve(import.meta.dirname, "../../../assets");
const SRGB_ICC_PATH = path.join(ASSETS_DIR, "pdf", "srgb.icc");

function xmpPacket(title: string, docId: string, dateIso: string): string {
  // XMP de conformidad PDF/A-3a + PDF/UA-1. Sin comprimir (requisito PDF/A).
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
    xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"
    xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
   <pdfaid:part>3</pdfaid:part>
   <pdfaid:conformance>A</pdfaid:conformance>
   <pdfuaid:part>1</pdfuaid:part>
   <dc:format>application/pdf</dc:format>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li></rdf:Alt></dc:title>
   <dc:language><rdf:Bag><rdf:li>es-CL</rdf:li></rdf:Bag></dc:language>
   <xmp:CreatorTool>Bioalergia Intranet</xmp:CreatorTool>
   <xmp:CreateDate>${dateIso}</xmp:CreateDate>
   <xmp:ModifyDate>${dateIso}</xmp:ModifyDate>
   <xmpMM:DocumentID>uuid:${docId}</xmpMM:DocumentID>
   <xmpMM:InstanceID>uuid:${docId}</xmpMM:InstanceID>
   <pdf:Producer>Bioalergia (pdf-lib)</pdf:Producer>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;"
  );
}

/**
 * Convierte el documento pdf-lib en PDF/A-3a + PDF/UA SIN Ghostscript (que borra
 * los tags): agrega OutputIntent sRGB (ICC) + XMP de conformidad + /Metadata.
 * Requiere que el documento YA esté tagged (PdfTagger.finalize) + fuentes
 * embebidas + Lang. `docId` debe ser un UUID; `dateIso` un timestamp ISO-8601.
 */
export function applyPdfaUa(
  pdfDoc: PDFDocument,
  opts: { title: string; docId: string; dateIso: string }
): void {
  const ctx = pdfDoc.context;

  // 1) Perfil ICC sRGB embebido (OutputIntent) — requisito PDF/A.
  const iccBytes = new Uint8Array(fs.readFileSync(SRGB_ICC_PATH));
  const iccStream = ctx.stream(iccBytes, { N: 3 });
  const iccRef = ctx.register(iccStream);
  const outputIntent = ctx.obj({
    Type: "OutputIntent",
    S: "GTS_PDFA1",
    OutputConditionIdentifier: PDFString.of("sRGB"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
    DestOutputProfile: iccRef,
  });
  pdfDoc.catalog.set(PDFName.of("OutputIntents"), ctx.obj([ctx.register(outputIntent)]));

  // 2) XMP de conformidad (PDF/A-3a + PDF/UA-1) como stream /Metadata sin filtro.
  const xmp = xmpPacket(opts.title, opts.docId, opts.dateIso);
  const metaStream = ctx.stream(xmp, { Type: "Metadata", Subtype: "XML" });
  pdfDoc.catalog.set(PDFName.of("Metadata"), ctx.register(metaStream));
}
