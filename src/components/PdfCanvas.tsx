import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { extractTextItems, renderPage, sampleBackgroundColor } from "../lib/pdfEngine";
import type {
  EditorElement,
  EllipseElement,
  ExistingTextItem,
  LineElement,
  PageSize,
  RectangleElement,
  TextElement,
  ToolId,
} from "../lib/types";

const SHAPE_TOOLS: ToolId[] = ["rectangle", "ellipse", "line"];
const DEFAULT_STROKE = "#1f2430";

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
  pendingImage: string | null;
  onConsumePendingImage: () => void;
  onCommitTextEdit: (item: ExistingTextItem, newText: string, backgroundColor: string, width: number) => void;
}

type DragState =
  | { mode: "move"; id: string; offsetX: number; offsetY: number }
  | { mode: "resize"; id: string; startX: number; startY: number; startWidth: number; startHeight: number }
  | { mode: "edit-width"; startX: number; startWidth: number }
  | { mode: "draw-shape"; kind: "rectangle" | "ellipse" | "line"; startX: number; startY: number }
  | { mode: "pan"; startX: number; startY: number; startScrollLeft: number; startScrollTop: number };

interface DraftShape {
  kind: "rectangle" | "ellipse" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  descending: boolean;
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
  const [editingWidth, setEditingWidth] = useState<number | null>(null);
  const [draftShape, setDraftShape] = useState<DraftShape | null>(null);
  const dragState = useRef<DragState | null>(null);
  const cancelEditRef = useRef(false);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    renderPage(pdfDoc, pageIndex, canvasRef.current, zoom).then(setPageSize);
    extractTextItems(pdfDoc, pageIndex, zoom).then(setExistingText);
    setEditingItemId(null);
  }, [pdfDoc, pageIndex, zoom]);

  const pageElements = elements.filter((e) => e.page === pageIndex);

  const replacedIds = new Set(
    pageElements.filter((e) => e.id.endsWith("-erase")).map((e) => e.id.replace(/-erase$/, ""))
  );
  const editableTextItems = existingText.filter((item) => !replacedIds.has(item.id));

  function handleExistingTextClick(e: React.MouseEvent, item: ExistingTextItem) {
    if (activeTool !== "select") return;
    e.stopPropagation();
    setEditingItemId(item.id);
    setEditingWidth(item.width);
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
    const width = editingWidth ?? item.width;
    setEditingWidth(null);
    if (cancelEditRef.current) return;
    const newText = (e.currentTarget.textContent ?? "").trim();
    if (!newText || newText === item.text) return;
    const bg = canvasRef.current ? sampleBackgroundColor(canvasRef.current, item.x, item.y) : "#ffffff";
    onCommitTextEdit(item, newText, bg, width);
  }

  function overlayPoint(e: React.MouseEvent): { x: number; y: number } {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleOverlayMouseDown(e: React.MouseEvent) {
    if (SHAPE_TOOLS.includes(activeTool)) {
      const { x, y } = overlayPoint(e);
      dragState.current = { mode: "draw-shape", kind: activeTool as "rectangle" | "ellipse" | "line", startX: x, startY: y };
      setDraftShape({ kind: activeTool as "rectangle" | "ellipse" | "line", x, y, width: 0, height: 0, descending: true });
    }
  }

  function handleCanvasClick(e: React.MouseEvent) {
    if (SHAPE_TOOLS.includes(activeTool) || activeTool === "pan") return; // handled by mousedown/drag instead
    const { x, y } = overlayPoint(e);

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
    } else {
      onSelectElement(null);
    }
  }

  function handleElementMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (activeTool === "erase") {
      onDeleteElement(id);
      return;
    }
    onSelectElement(id);
    if (activeTool !== "select") return;
    const el = elements.find((el) => el.id === id);
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!el || !rect) return;
    dragState.current = { mode: "move", id, offsetX: e.clientX - rect.left - el.x, offsetY: e.clientY - rect.top - el.y };
  }

  function handleElementClick(e: React.MouseEvent) {
    e.stopPropagation();
  }

  function startResize(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const el = elements.find((el) => el.id === id);
    if (!el) return;
    dragState.current = { mode: "resize", id, startX: e.clientX, startY: e.clientY, startWidth: el.width, startHeight: el.height };
    onSelectElement(id);
  }

  function startEditWidthResize(e: React.MouseEvent, currentWidth: number) {
    e.stopPropagation();
    e.preventDefault();
    dragState.current = { mode: "edit-width", startX: e.clientX, startWidth: currentWidth };
  }

  function startPan(e: React.MouseEvent) {
    if (activeTool !== "pan" || !scrollRef.current) return;
    dragState.current = {
      mode: "pan",
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: scrollRef.current.scrollLeft,
      startScrollTop: scrollRef.current.scrollTop,
    };
  }

  function onDrag(e: React.MouseEvent) {
    const state = dragState.current;
    if (!state) return;

    if (state.mode === "pan") {
      if (!scrollRef.current) return;
      scrollRef.current.scrollLeft = state.startScrollLeft - (e.clientX - state.startX);
      scrollRef.current.scrollTop = state.startScrollTop - (e.clientY - state.startY);
      return;
    }

    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (state.mode === "move") {
      onUpdateElement(state.id, { x: e.clientX - rect.left - state.offsetX, y: e.clientY - rect.top - state.offsetY });
    } else if (state.mode === "resize") {
      const newWidth = Math.max(20, state.startWidth + (e.clientX - state.startX));
      const newHeight = Math.max(14, state.startHeight + (e.clientY - state.startY));
      onUpdateElement(state.id, { width: newWidth, height: newHeight });
    } else if (state.mode === "edit-width") {
      const newWidth = Math.max(30, state.startWidth + (e.clientX - state.startX));
      setEditingWidth(newWidth);
    } else if (state.mode === "draw-shape") {
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      const x = Math.min(state.startX, curX);
      const y = Math.min(state.startY, curY);
      const width = Math.abs(curX - state.startX);
      const height = Math.abs(curY - state.startY);
      const descending = (curX >= state.startX) === (curY >= state.startY);
      setDraftShape({ kind: state.kind, x, y, width, height, descending });
    }
  }

  function endDrag() {
    const state = dragState.current;
    if (state?.mode === "draw-shape" && draftShape) {
      if (draftShape.width > 4 || draftShape.height > 4) {
        commitShape(draftShape);
      }
    }
    setDraftShape(null);
    dragState.current = null;
  }

  function commitShape(shape: DraftShape) {
    const id = crypto.randomUUID();
    const base = { id, page: pageIndex, x: shape.x, y: shape.y, width: Math.max(shape.width, 4), height: Math.max(shape.height, 4) };
    let el: RectangleElement | EllipseElement | LineElement;
    if (shape.kind === "rectangle") {
      el = { ...base, kind: "rectangle", strokeColor: DEFAULT_STROKE, strokeWidth: 2, fillColor: null };
    } else if (shape.kind === "ellipse") {
      el = { ...base, kind: "ellipse", strokeColor: DEFAULT_STROKE, strokeWidth: 2, fillColor: null };
    } else {
      el = { ...base, kind: "line", strokeColor: DEFAULT_STROKE, strokeWidth: 2, descending: shape.descending };
    }
    onAddElement(el);
    onSelectElement(id);
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setScrollRatio(max > 0 ? el.scrollTop / max : 0);
  }

  const stageCursor = activeTool === "pan" ? "grab" : undefined;

  return (
    <div className={`canvas-stage ${activeTool === "pan" ? "is-pannable" : ""}`} ref={scrollRef} onScroll={handleScroll} style={{ cursor: stageCursor }}>
      <div
        className="page-wrap"
        style={{ width: pageSize.width, height: pageSize.height }}
        onMouseDown={startPan}
        onMouseMove={onDrag}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <canvas ref={canvasRef} className="pdf-canvas" />
        <div
          ref={overlayRef}
          className={`overlay ${SHAPE_TOOLS.includes(activeTool) ? "overlay-crosshair" : ""}`}
          style={{ width: pageSize.width, height: pageSize.height }}
          onMouseDown={handleOverlayMouseDown}
          onClick={handleCanvasClick}
        >
          {pageElements.map((el) => (
            <OverlayElement
              key={el.id}
              el={el}
              selected={selectedId === el.id}
              onMouseDown={(e) => handleElementMouseDown(e, el.id)}
              onClick={handleElementClick}
              onResizeStart={(e) => startResize(e, el.id)}
              onChangeText={(text) => onUpdateElement(el.id, { content: text } as Partial<TextElement>)}
            />
          ))}
          {draftShape && <ShapePreview shape={draftShape} />}
        </div>

        <div className="existing-text-layer" style={{ width: pageSize.width, height: pageSize.height }}>
          {editableTextItems.map((item) =>
            editingItemId === item.id ? (
              <div key={item.id} className="editing-wrap">
                <div
                  className="existing-text-editing"
                  style={{
                    left: item.x,
                    top: item.y,
                    width: editingWidth ?? item.width,
                    minHeight: item.height,
                    fontSize: item.fontSize,
                    pointerEvents: "auto",
                  }}
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
                <div
                  className="edit-width-handle"
                  style={{ left: item.x + (editingWidth ?? item.width), top: item.y + item.height / 2, pointerEvents: "auto" }}
                  title="Drag to fit on one line, or narrower to wrap"
                  onMouseDown={(e) => startEditWidthResize(e, editingWidth ?? item.width)}
                />
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

      <div className="page-gauge" aria-hidden="true">
        <div className="page-gauge-track">
          <div className="page-gauge-thumb" style={{ top: `calc(${scrollRatio * 100}% - 10px)` }} />
        </div>
      </div>

      <style>{`
        .canvas-stage {
          grid-area: canvas;
          background: var(--bg-canvas);
          overflow: auto;
          display: flex;
          justify-content: center;
          padding: 40px 56px 40px 24px;
          position: relative;
        }
        .canvas-stage.is-pannable:active {
          cursor: grabbing;
        }
        .page-wrap {
          position: relative;
          box-shadow: 0 1px 3px rgba(15,23,42,0.08), 0 8px 24px rgba(15,23,42,0.10);
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
        .element-draggable {
          cursor: grab;
        }
        .element-draggable:active {
          cursor: grabbing;
        }
        .resize-handle {
          position: absolute;
          width: 11px;
          height: 11px;
          margin-left: -6px;
          margin-top: -6px;
          background: var(--accent-blue);
          border: 1px solid #ffffff;
          box-shadow: 0 0 0 1px var(--accent-blue-strong);
          border-radius: 2px;
          cursor: nwse-resize;
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
          background: var(--accent-blue-soft);
          outline: 1px solid var(--accent-blue);
        }
        .existing-text-editing {
          position: absolute;
          background: var(--paper-100);
          color: var(--text-primary);
          font-family: var(--font-ui);
          outline: 2px solid var(--accent-blue);
          padding: 1px 2px;
          white-space: pre-wrap;
          line-height: 1.15;
        }
        .edit-width-handle {
          position: absolute;
          width: 10px;
          height: 22px;
          margin-left: -5px;
          margin-top: -11px;
          background: var(--accent-blue);
          border: 1px solid #ffffff;
          box-shadow: 0 0 0 1px var(--accent-blue-strong);
          border-radius: 2px;
          cursor: ew-resize;
        }
        .page-gauge {
          position: fixed;
          right: calc(var(--properties-width) + 18px);
          top: calc(var(--header-height) + var(--tools-height) + 24px);
          bottom: calc(var(--status-height) + 24px);
          width: 3px;
        }
        .page-gauge-track {
          position: relative;
          height: 100%;
          background: var(--border);
          border-radius: 2px;
        }
        .page-gauge-thumb {
          position: absolute;
          left: -3px;
          width: 9px;
          height: 20px;
          background: var(--accent-blue);
          border-radius: 2px;
        }
        @media (max-width: 900px) {
          .page-gauge { display: none; }
        }
      `}</style>
    </div>
  );
}

function ShapePreview({ shape }: { shape: DraftShape }) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: shape.x,
    top: shape.y,
    width: shape.width,
    height: shape.height,
    pointerEvents: "none",
  };
  if (shape.kind === "rectangle") {
    return <div style={{ ...style, border: `2px dashed var(--accent-blue)` }} />;
  }
  if (shape.kind === "ellipse") {
    return <div style={{ ...style, border: `2px dashed var(--accent-blue)`, borderRadius: "50%" }} />;
  }
  const [x1, y1, x2, y2] = shape.descending ? [0, 0, shape.width, shape.height] : [0, shape.height, shape.width, 0];
  return (
    <svg style={style} width={shape.width} height={shape.height}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent-blue)" strokeWidth={2} strokeDasharray="4 3" />
    </svg>
  );
}

function OverlayElement({
  el,
  selected,
  onMouseDown,
  onClick,
  onResizeStart,
  onChangeText,
}: {
  el: EditorElement;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onChangeText: (v: string) => void;
}) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    outline: selected ? "2px solid var(--accent-blue)" : "1px dashed transparent",
  };

  const handle = selected && (
    <div className="resize-handle" style={{ left: el.x + el.width, top: el.y + el.height }} onMouseDown={onResizeStart} onClick={onClick} />
  );

  if (el.kind === "text") {
    return (
      <>
        <div
          className="element-draggable"
          style={{
            ...baseStyle,
            height: "auto",
            minHeight: el.height,
            overflow: "visible",
            fontSize: el.fontSize,
            color: el.color,
            fontFamily: "var(--font-ui)",
            fontWeight: el.bold ? 700 : 400,
            fontStyle: el.italic ? "italic" : "normal",
          }}
          contentEditable
          suppressContentEditableWarning
          onMouseDown={onMouseDown}
          onClick={onClick}
          onBlur={(e) => onChangeText(e.currentTarget.textContent ?? "")}
        >
          {el.content}
        </div>
        {handle}
      </>
    );
  }

  if (el.kind === "image" || el.kind === "signature") {
    return (
      <>
        <img
          className="element-draggable"
          src={el.dataUrl}
          style={{ ...baseStyle, objectFit: "contain" }}
          onMouseDown={onMouseDown}
          onClick={onClick}
          draggable={false}
        />
        {handle}
      </>
    );
  }

  if (el.kind === "rectangle" || el.kind === "ellipse") {
    return (
      <>
        <div
          className="element-draggable"
          style={{
            ...baseStyle,
            border: `${el.strokeWidth}px solid ${el.strokeColor}`,
            background: el.fillColor ?? "transparent",
            borderRadius: el.kind === "ellipse" ? "50%" : 0,
          }}
          onMouseDown={onMouseDown}
          onClick={onClick}
        />
        {handle}
      </>
    );
  }

  if (el.kind === "line") {
    const [x1, y1, x2, y2] = el.descending ? [0, 0, el.width, el.height] : [0, el.height, el.width, 0];
    return (
      <>
        <svg className="element-draggable" style={baseStyle} width={el.width} height={el.height} onMouseDown={onMouseDown} onClick={onClick}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={el.strokeColor} strokeWidth={el.strokeWidth} />
          <line x1={0} y1={0} x2={el.width} y2={el.height} stroke="transparent" strokeWidth={Math.max(el.strokeWidth, 10)} />
        </svg>
        {handle}
      </>
    );
  }

  // erase patch
  return (
    <>
      <div className="element-draggable" style={{ ...baseStyle, background: el.color }} onMouseDown={onMouseDown} onClick={onClick} />
      {handle}
    </>
  );
}
