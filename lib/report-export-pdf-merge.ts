import {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFArray,
  type PDFPage,
} from "pdf-lib";
import {
  TOC_LINK_RECTS,
  type TocSection,
} from "@/lib/report-export-pdf-premium-shared";

export async function prependPdfDocument(
  bodyPdfBytes: ArrayBuffer,
  prefixPdfBytes: ArrayBuffer,
): Promise<Uint8Array> {
  const body = await PDFDocument.load(bodyPdfBytes);
  const prefix = await PDFDocument.load(prefixPdfBytes);
  const merged = await PDFDocument.create();

  const prefixPages = await merged.copyPages(prefix, prefix.getPageIndices());
  prefixPages.forEach((page) => merged.addPage(page));

  const bodyPages = await merged.copyPages(body, body.getPageIndices());
  bodyPages.forEach((page) => merged.addPage(page));

  return merged.save();
}

export type TocLinkSpec = {
  /** 0-based index of the TOC page in the merged PDF */
  tocPageIndex: number;
  sections: TocSection[];
};

function appendAnnot(
  page: PDFPage,
  doc: PDFDocument,
  annotRef: ReturnType<PDFDocument["context"]["register"]>,
) {
  const annotsKey = PDFName.of("Annots");
  const pageNode = page.node;
  const existing = pageNode.lookup(annotsKey);
  if (existing instanceof PDFArray) {
    existing.push(annotRef);
  } else {
    pageNode.set(annotsKey, doc.context.obj([annotRef]));
  }
}

export async function addTocInternalLinks(
  pdfBytes: Uint8Array,
  spec: TocLinkSpec,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  const tocPage = pages[spec.tocPageIndex];
  if (!tocPage) return pdfBytes;

  const pageHeight = tocPage.getHeight();
  const left = 52;
  const width = 491;

  spec.sections.forEach((section, i) => {
    const topFromPageTop = TOC_LINK_RECTS.firstRowTop + i * TOC_LINK_RECTS.rowHeight;
    const pdfY = pageHeight - topFromPageTop - TOC_LINK_RECTS.rowHeight;
    const targetIndex = section.pageNumber - 1;
    const targetPage = pages[targetIndex];
    if (!targetPage) return;

    const ctx = doc.context;
    const annot = ctx.register(
      ctx.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [
          PDFNumber.of(left),
          PDFNumber.of(pdfY),
          PDFNumber.of(left + width),
          PDFNumber.of(pdfY + TOC_LINK_RECTS.rowHeight),
        ],
        Border: [PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)],
        Dest: ctx.obj([targetPage.ref, PDFName.of("Fit")]),
      }),
    );
    appendAnnot(tocPage, doc, annot);
  });

  return doc.save();
}

export async function downloadPdfBytes(
  bytes: Uint8Array,
  filename: string,
): Promise<void> {
  const blob = new Blob([new Uint8Array(bytes)], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
