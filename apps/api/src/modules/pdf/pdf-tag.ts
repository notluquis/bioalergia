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
