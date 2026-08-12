export type ToolId = "select" | "text" | "image" | "signature" | "erase";

export interface BaseElement {
  id: string;
  page: number; // 0-indexed
  x: number; // px, relative to rendered page at 100% zoom
  y: number;
  width: number;
  height: number;
}

export interface TextElement extends BaseElement {
  kind: "text";
  content: string;
  fontSize: number;
  color: string; // hex
  fontFamily: "sans" | "serif" | "mono";
}

export interface ImageElement extends BaseElement {
  kind: "image";
  dataUrl: string; // base64 png/jpg
}

export interface SignatureElement extends BaseElement {
  kind: "signature";
  dataUrl: string; // base64 png, transparent background
}

export interface EraseElement extends BaseElement {
  kind: "erase";
  color: string; // patch color, typically page background sample
}

export type EditorElement = TextElement | ImageElement | SignatureElement | EraseElement;

export interface PageSize {
  width: number;
  height: number;
}

/** A text run detected in the original PDF via pdf.js's text layer. */
export interface ExistingTextItem {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: "sans" | "serif" | "mono";
}

/** Serialized session: original PDF bytes + all edits, reopenable later. */
export interface ProjectFile {
  format: "pdfedits-project";
  version: 1;
  fileName: string;
  pdfBase64: string;
  elements: EditorElement[];
}
