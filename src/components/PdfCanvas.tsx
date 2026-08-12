import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { extractTextItems, renderPage, sampleBackgroundColor } from "../lib/pdfEngine";
import type { EditorElement, ExistingTextItem, PageSize, TextElement, ToolId } from "../lib/types";

interface Props {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageIndex: number;
  zoom: number;
  activeTool: ToolId;
  elements: EditorElement[];
  eraseWidth: number;
  eraseThickness: number;
  onAddElement: (el: EditorElement) => void;
  onUpdateElement: (id: string, patch: Partial<EditorElement>) => void;
  onDeleteElement: (id: string) => void;
  onSelectElement: (id: string | null) => void;
  selectedId: string | null;
  pendingImage: string | null; // dataUrl queued from file/signature pad, placed on next click
  onConsumePendingImage: () => void;
  onCommitTextEdit: (item: ExistingTextItem, newText: string, backgroundColor: string) => void;
}

export function PdfCanvas({
  pdfDoc,
  pageIndex,
  zoom,
  activeTool,
  elements,
  eraseWidth,
  eraseThickness,
  onAddElement,
  onUpdateElement,
  onDeleteElement,
  onSelectElement,
  selectedId,
  pendingImage,
  onConsumePendingImage,
  onCommitTextEdit,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState<PageSize>({ width: 0, height: 0 });
  const [scrollRatio, setScrollRatio] = useState(0);
  const [existingText, setExistingText] = useState<ExistingTextItem[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const cancelEditRef = useRef(false);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    renderPage(pdfDoc, pageIndex, canvasRef.current, zoom).then(setPageSize);
    extractTextItems(pdfDoc, pageIndex, zoom).then(setExistingText);
    setEditingItemId(null);
  }, [pdfDoc, pageIndex, zoom]);

  const pageElements = elements.filter((e) => e.page === pageIndex);

  // A text run counts as "replaced" once the user has edited it — its erase+text
  // patch pair lives in `elements` from then on, so we stop showing the raw
  // pdf.js click target for it (the patch pair renders through pageElements instead).
  const replacedIds = new Set(
    pageElements.filter((e) => e.id.endsWith("-erase")).map((e) => e.id.replace(/-erase$/, ""))
  );
  const editableTextItems = existingText.filter((item) => !replacedIds.has(item.id));

  function handleExistingTextClick(e: React.MouseEvent, item: ExistingTextItem) {
    if (activeTool !== "select") return;
    e.stopPropagation();
    setEditingItemId(item.id);
    cancelEditRef.current = false;
  }

  function handleExistingTextKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      cancelEditRef.current = true;
      (e.target as HTMLElement).blur();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }

  function selectAllText(el: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function handleExistingTextBlur(e: React.FocusEvent, item: ExistingTextItem) {
    setEditingItemId(null);
    if (cancelEditRef.current) return;
    const newText = (e.currentTarget.textContent ?? "").trim();
    if (!newText || newText === item.text) return;
    const bg = canvasRef.current ? sampleBackgroundColor(canvasRef.current, item.x, item.y) : "#ffffff";
    onCommitTextEdit(item, newText, bg);
  }

  function handleCanvasClick(e: React.MouseEvent) {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "text") {
      const el: TextElement = {
        id: crypto.randomUUID(),
        kind: "text",
        page: pageIndex,
        x,
        y,
        width: 180,
        height: 28,
        content: "Edit me",
        fontSize: 16,
        color: "#22262f",
        fontFamily: "sans",
      };
      onAddElement(el);
      onSelectElement(el.id);
    } else if ((activeTool === "image" || activeTool === "signature") && pendingImage) {
      onAddElement({
        id: crypto.randomUUID(),
        kind: activeTool,
        page: pageIndex,
        x,
        y,
        width: activeTool === "signature" ? 160 : 200,
        height: activeTool === "signature" ? 60 : 140,
        dataUrl: pendingImage,
      } as EditorElement);
      onConsumePendingImage();
    } else if (activeTool === "erase") {
      const hit = findElementAt(x, y);
      if (hit) {
        onDeleteElement(hit.id);
      } else {
        onAddElement({
          id: crypto.randomUUID(),
          kind: "erase",
          page: pageIndex,
          x: x - eraseWidth / 2,
          y: y - eraseThickness / 2,
          width: eraseWidth,
          height: eraseThickness,
          color: "#ffffff",
        } as EditorElement);
      }
    } else {
      onSelectElement(null);
    }
  }

  /** Topmost element under (x, y) — used so the erase tool can delete your
   *  own added elements outright instead of patching over them. */
  function findElementAt(x: number, y: number): EditorElement | undefined {
    for (let i = pageElements.length - 1; i >= 0; i--) {
      const el = pageElements[i];
      if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) return el;
    }
    return undefined;
  }

  function startDrag(e: React.MouseEvent, id: string) {
    if (activeTool !== "select") return;
    e.stopPropagation();
    const el = elements.find((el) => el.id === id);
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!el || !rect) return;
    dragState.current = { id, offsetX: e.clientX - rect.left - el.x, offsetY: e.clientY - rect.top - el.y };
    onSelectElement(id);
  }

  function onDrag(e: React.MouseEvent) {
    if (!dragState.current) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { id, offsetX, offsetY } = dragState.current;
    onUpdateElement(id, { x: e.clientX - rect.left - offsetX, y: e.clientY - rect.top - offsetY });
  }

  function endDrag() {
    dragState.current = null;
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setScrollRatio(max > 0 ? el.scrollTop / max : 0);
  }

  return (
    <div className="canvas-stage" ref={scrollRef} onScroll={handleScroll}>
      <div className="page-wrap" style={{ width: pageSize.width, height: pageSize.height }} onMouseMove={onDrag} onMouseUp={endDrag} onMouseLeave={endDrag}>
        <canvas ref={canvasRef} className="pdf-canvas" />
        <div
          ref={overlayRef}
          className={`overlay ${activeTool !== "select" ? "overlay-crosshair" : ""}`}
          style={{ width: pageSize.width, height: pageSize.height }}
          onClick={handleCanvasClick}
        >
          {pageElements.map((el) => (
            <OverlayElement
              key={el.id}
              el={el}
              selected={selectedId === el.id}
              onMouseDown={(e) => startDrag(e, el.id)}
              onChangeText={(text) => onUpdateElement(el.id, { content: text } as Partial<TextElement>)}
            />
          ))}
        </div>

        <div className="existing-text-layer" style={{ width: pageSize.width, height: pageSize.height }}>
          {editableTextItems.map((item) =>
            editingItemId === item.id ? (
              <div
                key={item.id}
                className="existing-text-editing"
                style={{ left: item.x, top: item.y, width: Math.max(item.width, 40), minHeight: item.height, fontSize: item.fontSize, pointerEvents: "auto" }}
                contentEditable
                suppressContentEditableWarning
                autoFocus
                onFocus={(e) => selectAllText(e.currentTarget)}
                onKeyDown={handleExistingTextKeyDown}
                onBlur={(e) => handleExistingTextBlur(e, item)}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {item.text}
              </div>
            ) : (
              <div
                key={item.id}
                className="existing-text-hit"
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                  pointerEvents: activeTool === "select" ? "auto" : "none",
                }}
                title="Click to edit this text"
                onClick={(e) => handleExistingTextClick(e, item)}
              />
            )
          )}
        </div>
      </div>

      {/* Signature-element: amber tick-ruler tracking scroll position */}
      <div className="page-gauge" aria-hidden="true">
        <div className="page-gauge-track">
          <div className="page-gauge-thumb" style={{ top: `calc(${scrollRatio * 100}% - 10px)` }} />
        </div>
      </div>

      <style>{`
        .canvas-stage {
          grid-area: canvas;
          background: var(--ink-800);
          overflow: auto;
          display: flex;
          justify-content: center;
          padding: 40px 56px 40px 24px;
          position: relative;
        }
        .page-wrap {
          position: relative;
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
          height: fit-content;
        }
        .pdf-canvas {
          display: block;
          background: var(--paper-100);
        }
        .overlay {
          position: absolute;
          top: 0;
          left: 0;
        }
        .overlay-crosshair {
          cursor: crosshair;
        }
        .existing-text-layer {
          position: absolute;
          top: 0;
          left: 0;
          pointer-events: none;
        }
        .existing-text-hit {
          position: absolute;
          cursor: text;
          border-radius: 2px;
          transition: background 100ms ease, outline 100ms ease;
        }
        .existing-text-hit:hover {
          background: rgba(217, 137, 54, 0.16);
          outline: 1px solid var(--accent-amber);
        }
        .existing-text-editing {
          position: absolute;
          background: var(--paper-100);
          color: var(--text-on-paper);
          font-family: var(--font-ui);
          outline: 2px solid var(--accent-amber);
          padding: 1px 2px;
          white-space: pre-wrap;
          line-height: 1.15;
        }
        .page-gauge {
          position: fixed;
          right: calc(var(--panel-width) + 18px);
          top: calc(var(--topbar-height) + 24px);
          bottom: 24px;
          width: 3px;
        }
        .page-gauge-track {
          position: relative;
          height: 100%;
          background: var(--ink-700);
          border-radius: 2px;
        }
        .page-gauge-thumb {
          position: absolute;
          left: -3px;
          width: 9px;
          height: 20px;
          background: var(--accent-amber);
          border-radius: 2px;
        }
        @media (max-width: 860px) {
          .page-gauge { display: none; }
        }
      `}</style>
    </div>
  );
}

function OverlayElement({
  el,
  selected,
  onMouseDown,
  onChangeText,
}: {
  el: EditorElement;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onChangeText: (v: string) => void;
}) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    outline: selected ? "2px solid var(--accent-amber)" : "1px dashed transparent",
    cursor: "move",
  };

  if (el.kind === "text") {
    return (
      <div
        style={{
          ...baseStyle,
          fontSize: el.fontSize,
          color: el.color,
          fontFamily: "var(--font-ui)",
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? "italic" : "normal",
        }}
        contentEditable
        suppressContentEditableWarning
        onMouseDown={onMouseDown}
        onBlur={(e) => onChangeText(e.currentTarget.textContent ?? "")}
      >
        {el.content}
      </div>
    );
  }

  if (el.kind === "image" || el.kind === "signature") {
    return <img src={el.dataUrl} style={{ ...baseStyle, objectFit: "contain" }} onMouseDown={onMouseDown} draggable={false} />;
  }

  // erase patch
  return <div style={{ ...baseStyle, background: el.color }} onMouseDown={onMouseDown} />;
}
