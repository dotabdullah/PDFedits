export type ToolId =
  | "select"
  | "pan"
  | "text"
  | "image"
  | "signature"
  | "rectangle"
  | "ellipse"
  | "line"
  | "erase"
  | "highlight"
  | "underline"
  | "strikethrough"
  | "note"
  | "draw";

export type ViewMode = "single" | "continuous";

export interface BaseElement {
  id: string;
  page: number; // 0-indexed
  x: number; // px, relative to rendered page at 100% zoom
  y: number;
  width: number;
  height: number;
  rotation?: number; // degrees, clockwise
}

export interface TextElement extends BaseElement {
  kind: "text";
  content: string;
  fontSize: number;
  color: string; // hex
  fontFamily: "sans" | "serif" | "mono";
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
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

export interface RectangleElement extends BaseElement {
  kind: "rectangle";
  strokeColor: string;
  strokeWidth: number;
  fillColor: string | null; // null = no fill, outline only
}

export interface EllipseElement extends BaseElement {
  kind: "ellipse";
  strokeColor: string;
  strokeWidth: number;
  fillColor: string | null;
}

export interface LineElement extends BaseElement {
  kind: "line";
  strokeColor: string;
  strokeWidth: number;
  /** true: line runs top-left→bottom-right of its bbox; false: bottom-left→top-right. Lets a non-negative bbox still represent either diagonal. */
  descending: boolean;
}

export interface HighlightElement extends BaseElement {
  kind: "highlight";
  color: string;
}

export interface TextMarkElement extends BaseElement {
  kind: "textmark";
  style: "underline" | "strikethrough";
  color: string;
  strokeWidth: number;
}

/** A "baked-in" comment marker — not a real interactive PDF annotation, just a
 *  small icon + its text drawn permanently onto the page at export time (see
 *  README's "On sticky notes" note for why). */
export interface NoteElement extends BaseElement {
  kind: "note";
  content: string;
  color: string;
}

/** Freehand pencil stroke. Points are normalized to a 0–1 range relative to
 *  the element's own bbox (width/height), so the standard resize handle can
 *  scale the whole stroke just by scaling the bbox — no separate path-scaling logic needed. */
export interface FreehandElement extends BaseElement {
  kind: "freehand";
  points: { x: number; y: number }[];
  strokeColor: string;
  strokeWidth: number;
}

export type EditorElement =
  | TextElement
  | ImageElement
  | SignatureElement
  | EraseElement
  | RectangleElement
  | EllipseElement
  | LineElement
  | HighlightElement
  | TextMarkElement
  | NoteElement
  | FreehandElement;

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
  bold: boolean;
  italic: boolean;
}

/** A text match from in-document search. */
export interface SearchMatch {
  page: number;
  snippet: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

export type ZoomMode = "custom" | "fit-width" | "fit-page" | "actual";

/** Serialized session: original PDF bytes + all edits, reopenable later. */
export interface ProjectFile {
  format: "pdfedits-project";
  version: 1;
  fileName: string;
  pdfBase64: string;
  elements: EditorElement[];
}
