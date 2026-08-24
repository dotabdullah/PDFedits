import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { PDFDocument, rgb, StandardFonts, PDFFont, degrees, LineCapStyle } from "pdf-lib";
import type { EditorElement, ExistingTextItem, PageSize, SearchMatch, SearchOptions } from "./types";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const FONT_VARIANTS: Record<"sans" | "serif" | "mono", { normal: keyof typeof StandardFonts; bold: keyof typeof StandardFonts; italic: keyof typeof StandardFonts; boldItalic: keyof typeof StandardFonts }> = {
  sans: { normal: "Helvetica", bold: "HelveticaBold", italic: "HelveticaOblique", boldItalic: "HelveticaBoldOblique" },
  serif: { normal: "TimesRoman", bold: "TimesRomanBold", italic: "TimesRomanItalic", boldItalic: "TimesRomanBoldItalic" },
  mono: { normal: "Courier", bold: "CourierBold", italic: "CourierOblique", boldItalic: "CourierBoldOblique" },
};

export async function loadPdfDocument(bytes: Uint8Array) {
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  return loadingTask.promise;
}

/**
 * Renders one page of the pdf.js document onto a canvas at the given CSS scale.
 * Returns the rendered page size in CSS pixels (used to position overlay elements).
 */
export async function renderPage(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number
): Promise<PageSize> {
  const page = await pdfDoc.getPage(pageIndex + 1); // pdf.js is 1-indexed
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context unavailable");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: context, viewport }).promise;

  return { width: viewport.width, height: viewport.height };
}

/**
 * v1 editing model: edits are overlays (new text boxes, images, signatures, and
 * opaque "erase" patches) composited onto the original page at export time.
 * This mirrors how most lightweight PDF editors (incl. PDFaid) handle edits,
 * since rewriting an existing PDF's internal text-content stream in place is
 * fragile across producers. Typing over an erase patch reads as "edited text."
 */
export async function flattenToPdf(
  originalBytes: Uint8Array,
  elements: EditorElement[],
  renderScale: number
): Promise<{ bytes: Uint8Array; hadUnsupportedChars: boolean }> {
  const pdfDoc = await PDFDocument.load(originalBytes);
  const pages = pdfDoc.getPages();
  const fontCache = new Map<string, PDFFont>();
  let hadUnsupportedChars = false;

  const getFont = async (family: "sans" | "serif" | "mono", bold: boolean, italic: boolean) => {
    const variant = FONT_VARIANTS[family] ?? FONT_VARIANTS.sans;
    const key = bold && italic ? variant.boldItalic : bold ? variant.bold : italic ? variant.italic : variant.normal;
    if (!fontCache.has(key)) {
      fontCache.set(key, await pdfDoc.embedFont(StandardFonts[key]));
    }
    return fontCache.get(key)!;
  };

  // The 12 standard PDF fonts only support WinAnsi (~Latin-1) — anything outside
  // that (Arabic/Urdu script, most emoji, many symbols) throws if drawn as-is.
  // Substituting "?" per unsupported character means a save/print never hard-fails
  // just because of one character — see README's "On non-Latin text" note.
  function sanitizeForFont(font: PDFFont, text: string): string {
    let sanitized = text;
    try {
      font.widthOfTextAtSize(text, 10);
      return text; // fast path: whole string is fine, skip the per-character loop
    } catch {
      sanitized = Array.from(text)
        .map((ch) => {
          try {
            font.widthOfTextAtSize(ch, 10);
            return ch;
          } catch {
            hadUnsupportedChars = true;
            return "?";
          }
        })
        .join("");
      return sanitized;
    }
  }

  for (const el of elements) {
    const page = pages[el.page];
    if (!page) continue;
    const { height: pageHeight } = page.getSize();

    // Convert from screen px (top-left origin, render scale) to PDF pt (bottom-left origin).
    const toPdfX = (x: number) => x / renderScale;
    const toPdfY = (y: number, h: number) => pageHeight - (y + h) / renderScale;

    if (el.kind === "erase") {
      page.drawRectangle({
        x: toPdfX(el.x),
        y: toPdfY(el.y, el.height),
        width: el.width / renderScale,
        height: el.height / renderScale,
        color: rgb(...hexToRgb(el.color)),
      });
    } else if (el.kind === "text") {
      const font = await getFont(el.fontFamily, !!el.bold, !!el.italic);
      const safeContent = sanitizeForFont(font, el.content);
      const fontSize = el.fontSize / renderScale;
      const textWidth = font.widthOfTextAtSize(safeContent, fontSize);
      const boxWidth = el.width / renderScale;
      const alignOffset = el.align === "center" ? (boxWidth - textWidth) / 2 : el.align === "right" ? boxWidth - textWidth : 0;
      const textX = toPdfX(el.x) + Math.max(0, alignOffset);
      const textY = toPdfY(el.y, el.fontSize) + el.fontSize * 0.15;
      page.drawText(safeContent, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(...hexToRgb(el.color)),
        maxWidth: boxWidth,
        rotate: degrees(el.rotation ?? 0),
      });
      if (el.underline) {
        const underlineY = textY - fontSize * 0.12;
        page.drawLine({
          start: { x: textX, y: underlineY },
          end: { x: textX + Math.min(textWidth, boxWidth), y: underlineY },
          thickness: Math.max(0.5, fontSize * 0.06),
          color: rgb(...hexToRgb(el.color)),
        });
      }
    } else if (el.kind === "image" || el.kind === "signature") {
      const isPng = el.dataUrl.startsWith("data:image/png");
      const bytes = dataUrlToBytes(el.dataUrl);
      const embedded = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      page.drawImage(embedded, {
        x: toPdfX(el.x),
        y: toPdfY(el.y, el.height),
        width: el.width / renderScale,
        height: el.height / renderScale,
        rotate: degrees(el.rotation ?? 0),
      });
    } else if (el.kind === "rectangle") {
      page.drawRectangle({
        x: toPdfX(el.x),
        y: toPdfY(el.y, el.height),
        width: el.width / renderScale,
        height: el.height / renderScale,
        borderColor: rgb(...hexToRgb(el.strokeColor)),
        borderWidth: el.strokeWidth,
        color: el.fillColor ? rgb(...hexToRgb(el.fillColor)) : undefined,
        rotate: degrees(el.rotation ?? 0),
      });
    } else if (el.kind === "ellipse") {
      page.drawEllipse({
        x: toPdfX(el.x) + el.width / renderScale / 2,
        y: toPdfY(el.y, el.height) + el.height / renderScale / 2,
        xScale: el.width / renderScale / 2,
        yScale: el.height / renderScale / 2,
        borderColor: rgb(...hexToRgb(el.strokeColor)),
        borderWidth: el.strokeWidth,
        color: el.fillColor ? rgb(...hexToRgb(el.fillColor)) : undefined,
        rotate: degrees(el.rotation ?? 0),
      });
    } else if (el.kind === "line") {
      const x1 = toPdfX(el.x);
      const x2 = toPdfX(el.x + el.width);
      const yTop = toPdfY(el.y, 0);
      const yBottom = toPdfY(el.y + el.height, 0);
      const start = el.descending ? { x: x1, y: yTop } : { x: x1, y: yBottom };
      const end = el.descending ? { x: x2, y: yBottom } : { x: x2, y: yTop };
      page.drawLine({ start, end, thickness: el.strokeWidth, color: rgb(...hexToRgb(el.strokeColor)) });
    } else if (el.kind === "highlight") {
      page.drawRectangle({
        x: toPdfX(el.x),
        y: toPdfY(el.y, el.height),
        width: el.width / renderScale,
        height: el.height / renderScale,
        color: rgb(...hexToRgb(el.color)),
        opacity: 0.35,
        rotate: degrees(el.rotation ?? 0),
      });
    } else if (el.kind === "textmark") {
      const markY = el.style === "underline" ? toPdfY(el.y, el.height * 0.92) : toPdfY(el.y, el.height * 0.5);
      page.drawLine({
        start: { x: toPdfX(el.x), y: markY },
        end: { x: toPdfX(el.x + el.width), y: markY },
        thickness: el.strokeWidth,
        color: rgb(...hexToRgb(el.color)),
      });
    } else if (el.kind === "note") {
      const markerSize = Math.min(el.width, el.height);
      page.drawRectangle({
        x: toPdfX(el.x),
        y: toPdfY(el.y, markerSize),
        width: markerSize / renderScale,
        height: markerSize / renderScale,
        color: rgb(...hexToRgb(el.color)),
      });
      if (el.content.trim()) {
        const font = await getFont("sans", false, false);
        const safeContent = sanitizeForFont(font, el.content);
        const noteFontSize = 8;
        page.drawText(safeContent, {
          x: toPdfX(el.x) + markerSize / renderScale + 4,
          y: toPdfY(el.y, markerSize / 2) - noteFontSize / 3,
          size: noteFontSize,
          font,
          color: rgb(0.1, 0.1, 0.12),
          maxWidth: 220,
        });
      }
    } else if (el.kind === "freehand") {
      // Points are normalized (0–1) relative to the element's own bbox — scale
      // back up to px, then convert each segment to PDF points same as everything else.
      const color = rgb(...hexToRgb(el.strokeColor));
      for (let i = 0; i < el.points.length - 1; i++) {
        const p1 = el.points[i];
        const p2 = el.points[i + 1];
        page.drawLine({
          start: { x: toPdfX(el.x + p1.x * el.width), y: toPdfY(el.y + p1.y * el.height, 0) },
          end: { x: toPdfX(el.x + p2.x * el.width), y: toPdfY(el.y + p2.y * el.height, 0) },
          thickness: el.strokeWidth,
          color,
          lineCap: LineCapStyle.Round,
        });
      }
    }
  }

  return { bytes: await pdfDoc.save(), hadUnsupportedChars };
}

/**
 * Extracts each run of real text on a page (via pdf.js's text layer) and maps
 * it into screen-pixel coordinates at the given render scale. This is what
 * powers "click existing text to edit it" — the returned items are overlaid
 * as click targets; editing one patches the original run and draws the new
 * text in its place at export time (see flattenToPdf's erase+text pairing).
 */
export async function extractTextItems(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  scale: number
): Promise<ExistingTextItem[]> {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const textContent = await page.getTextContent();
  const items: ExistingTextItem[] = [];

  textContent.items.forEach((raw, idx) => {
    const item = raw as { str: string; width: number; transform: number[]; fontName: string };
    if (!item.str || !item.str.trim()) return;

    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const width = item.width * scale;
    const x = tx[4];
    const y = tx[5] - fontHeight;

    const style = textContent.styles[item.fontName];
    const styleSignature = `${item.fontName} ${style?.fontFamily ?? ""}`;
    items.push({
      id: `pg${pageIndex}-t${idx}`,
      page: pageIndex,
      x,
      y,
      width,
      height: fontHeight,
      text: item.str,
      fontSize: fontHeight,
      fontFamily: guessFontFamily(styleSignature),
      bold: guessBold(styleSignature),
      italic: guessItalic(styleSignature),
    });
  });

  return items;
}

function guessFontFamily(name: string): "sans" | "serif" | "mono" {
  const n = name.toLowerCase();
  if (n.includes("times") || n.includes("serif") || n.includes("georgia") || n.includes("minion") || n.includes("garamond") || n.includes("cambria")) return "serif";
  if (n.includes("courier") || n.includes("mono") || n.includes("consolas")) return "mono";
  return "sans";
}

// pdf.js's `item.fontName` is an internal id ("g_d0_f1"), but PDF producers
// almost always keep the *subset tag + real font name* inside it (e.g.
// "g_d0_f1+ArialMT-Bold"), which is enough to catch weight/style even though
// we can't recover the exact embedded font program itself (see README).
function guessBold(name: string): boolean {
  const n = name.toLowerCase();
  return /bold|black|heavy|semibold/.test(n);
}

function guessItalic(name: string): boolean {
  const n = name.toLowerCase();
  return /italic|oblique/.test(n);
}

/**
 * Samples a pixel just outside the given box (above-left) to approximate the
 * page background color there, so the patch drawn behind edited text blends
 * in rather than defaulting to plain white on tinted or colored pages.
 */
export function sampleBackgroundColor(canvas: HTMLCanvasElement, x: number, y: number): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#ffffff";
  const sx = Math.min(canvas.width - 1, Math.max(0, Math.round(x)));
  const sy = Math.min(canvas.height - 1, Math.max(0, Math.round(y - 3)));
  const [r, g, b] = ctx.getImageData(sx, sy, 1, 1).data;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function canvasToImageBytes(canvas: HTMLCanvasElement, type: "png" | "jpg"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      type === "png" ? "image/png" : "image/jpeg",
      0.95
    );
  });
}

/**
 * Basic in-document search: scans every page's text layer for a case-insensitive
 * match and returns each hit's position (in screen px at the given scale) plus
 * a short snippet, so the UI can list results and jump/highlight on click.
 */
export async function searchDocument(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  query: string,
  scale: number,
  options: SearchOptions = { caseSensitive: false, wholeWord: false }
): Promise<SearchMatch[]> {
  const raw = query.trim();
  if (!raw) return [];
  const matches: SearchMatch[] = [];

  const test = (haystack: string): boolean => {
    const h = options.caseSensitive ? haystack : haystack.toLowerCase();
    const n = options.caseSensitive ? raw : raw.toLowerCase();
    if (!options.wholeWord) return h.includes(n);
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, options.caseSensitive ? "" : "i").test(h);
  };

  for (let pageIndex = 0; pageIndex < pdfDoc.numPages; pageIndex++) {
    const items = await extractTextItems(pdfDoc, pageIndex, scale);
    for (const item of items) {
      if (!test(item.text)) continue;
      const lower = options.caseSensitive ? item.text : item.text.toLowerCase();
      const needle = options.caseSensitive ? raw : raw.toLowerCase();
      const idx = Math.max(0, lower.indexOf(needle));
      const start = Math.max(0, idx - 20);
      const end = Math.min(item.text.length, idx + needle.length + 20);
      const snippet = `${start > 0 ? "…" : ""}${item.text.slice(start, end)}${end < item.text.length ? "…" : ""}`;
      matches.push({ page: pageIndex, snippet, x: item.x, y: item.y, width: item.width, height: item.height });
    }
  }

  return matches;
}

/** Removes one page (0-indexed) from a PDF and returns the new bytes. Used by the Pages panel's delete action. */
export async function deletePageFromPdf(bytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(bytes);
  pdfDoc.removePage(pageIndex);
  return pdfDoc.save();
}

/** Inserts a blank page after `afterIndex` (use -1 to insert at the very start). Matches the size of the nearest existing page. */
export async function addBlankPageToPdf(bytes: Uint8Array, afterIndex: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(bytes);
  const refPage = pdfDoc.getPage(Math.max(0, Math.min(afterIndex, pdfDoc.getPageCount() - 1)));
  const { width, height } = refPage.getSize();
  pdfDoc.insertPage(afterIndex + 1, [width, height]);
  return pdfDoc.save();
}

/** Duplicates a page, inserting the copy immediately after the original. */
export async function duplicatePageInPdf(bytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(bytes);
  const [copied] = await pdfDoc.copyPages(pdfDoc, [pageIndex]);
  pdfDoc.insertPage(pageIndex + 1, copied);
  return pdfDoc.save();
}

/** Inserts every page from `sourceBytes` after `afterIndex` in `targetBytes`. Returns the new bytes and how many pages were inserted. */
export async function insertPdfPages(
  targetBytes: Uint8Array,
  afterIndex: number,
  sourceBytes: Uint8Array
): Promise<{ bytes: Uint8Array; insertedCount: number }> {
  const targetDoc = await PDFDocument.load(targetBytes);
  const sourceDoc = await PDFDocument.load(sourceBytes);
  const indices = sourceDoc.getPageIndices();
  const copied = await targetDoc.copyPages(sourceDoc, indices);
  copied.forEach((page, i) => targetDoc.insertPage(afterIndex + 1 + i, page));
  return { bytes: await targetDoc.save(), insertedCount: copied.length };
}

/** Builds a brand-new PDF containing only the given (0-indexed) pages, in that order. Used for "Extract selected pages". */
export async function extractPagesFromPdf(bytes: Uint8Array, pageIndices: number[]): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(bytes);
  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(sourceDoc, pageIndices);
  copied.forEach((page) => newDoc.addPage(page));
  return newDoc.save();
}

/** Rebuilds the PDF with pages in `newOrder` (each entry is a 0-indexed page from the original). Used for drag-to-reorder. */
export async function reorderPdfPages(bytes: Uint8Array, newOrder: number[]): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(bytes);
  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(sourceDoc, newOrder);
  copied.forEach((page) => newDoc.addPage(page));
  return newDoc.save();
}

/** Rotates one page 90° clockwise (cumulative — call again for 180°/270°). */
export async function rotatePageInPdf(bytes: Uint8Array, pageIndex: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(pageIndex);
  const current = page.getRotation().angle;
  page.setRotation(degrees((current + 90) % 360));
  return pdfDoc.save();
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return [((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255];
}

/** Chunked to avoid call-stack overflow on large PDFs (String.fromCharCode(...bigArray) blows up). */
export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
