import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Trash2, FileText, Copy, RotateCw, Plus, FileOutput, FilePlus2 } from "lucide-react";
import { renderPage } from "../lib/pdfEngine";

const THUMB_SCALE = 0.16;

interface Props {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  numPages: number;
  currentPage: number;
  onSelectPage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onDuplicatePage: (index: number) => void;
  onRotatePage: (index: number) => void;
  onAddBlankPage: (afterIndex: number) => void;
  onInsertPdfPages: (afterIndex: number) => void;
  onReorderPages: (newOrder: number[]) => void;
  onExtractPages: (indices: number[]) => void;
}

export function PagesPanel({
  pdfDoc,
  numPages,
  currentPage,
  onSelectPage,
  onDeletePage,
  onDuplicatePage,
  onRotatePage,
  onAddBlankPage,
  onInsertPdfPages,
  onReorderPages,
  onExtractPages,
}: Props) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelected(new Set());
  }, [numPages]);

  function toggleSelected(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function handleDrop(targetIndex: number) {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    setDragOverIndex(null);
    if (from === null || from === targetIndex) return;
    const order = Array.from({ length: numPages }, (_, i) => i);
    const [moved] = order.splice(from, 1);
    order.splice(targetIndex, 0, moved);
    onReorderPages(order);
  }

  return (
    <aside className="pages-panel">
      <div className="pages-header">
        <span>Pages ({numPages})</span>
        {numPages > 0 && (
          <button
            className={`select-toggle ${selectMode ? "is-on" : ""}`}
            onClick={() => setSelectMode((s) => !s)}
            title="Select pages to extract"
          >
            Select
          </button>
        )}
      </div>

      <div className="pages-list">
        {!pdfDoc || numPages === 0 ? (
          <div className="pages-empty">
            <FileText size={28} strokeWidth={1.5} />
            <span>No pages</span>
          </div>
        ) : (
          Array.from({ length: numPages }, (_, i) => (
            <Thumbnail
              key={`${i}-${numPages}`}
              pdfDoc={pdfDoc}
              pageIndex={i}
              active={i === currentPage}
              selectMode={selectMode}
              checked={selected.has(i)}
              isDragOver={dragOverIndex === i}
              onClick={() => (selectMode ? toggleSelected(i) : onSelectPage(i))}
              onDelete={numPages > 1 ? () => onDeletePage(i) : undefined}
              onDuplicate={() => onDuplicatePage(i)}
              onRotate={() => onRotatePage(i)}
              onAddAfter={() => onAddBlankPage(i)}
              onDragStart={() => (dragIndexRef.current = i)}
              onDragOver={() => setDragOverIndex(i)}
              onDragLeave={() => setDragOverIndex((cur) => (cur === i ? null : cur))}
              onDrop={() => handleDrop(i)}
            />
          ))
        )}
      </div>

      {numPages > 0 && (
        <div className="pages-footer">
          {selectMode && selected.size > 0 ? (
            <button className="footer-btn primary" onClick={() => onExtractPages(Array.from(selected).sort((a, b) => a - b))}>
              <FileOutput size={14} /> Extract {selected.size} page{selected.size > 1 ? "s" : ""}
            </button>
          ) : (
            <>
              <button className="footer-btn" onClick={() => onAddBlankPage(currentPage)} title="Add blank page after current">
                <Plus size={14} /> Add page
              </button>
              <button className="footer-btn" onClick={() => onInsertPdfPages(currentPage)} title="Insert pages from another PDF">
                <FilePlus2 size={14} /> Insert PDF
              </button>
            </>
          )}
        </div>
      )}

      <style>{`
        .pages-panel {
          grid-area: pages;
          background: var(--bg-panel);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .pages-header {
          padding: 12px 14px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .select-toggle {
          font-size: 10.5px;
          font-weight: 600;
          color: var(--text-tertiary);
          background: var(--bg-canvas);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 3px 8px;
          cursor: pointer;
        }
        .select-toggle.is-on {
          background: var(--accent-blue-soft);
          border-color: var(--accent-blue);
          color: var(--accent-blue);
        }
        .pages-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pages-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: var(--text-tertiary);
          font-size: 12px;
          margin-top: 40px;
        }
        .pages-footer {
          padding: 10px;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .footer-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px;
          background: var(--bg-canvas);
          border: 1px solid var(--border);
          color: var(--text-primary);
          border-radius: var(--radius-sm);
          font-size: 11.5px;
          font-weight: 500;
          cursor: pointer;
        }
        .footer-btn:hover { border-color: var(--border-strong); }
        .footer-btn.primary {
          background: var(--accent-blue);
          border-color: var(--accent-blue);
          color: #fff;
        }
        .footer-btn.primary:hover { background: var(--accent-blue-strong); }
      `}</style>
    </aside>
  );
}

function Thumbnail({
  pdfDoc,
  pageIndex,
  active,
  selectMode,
  checked,
  isDragOver,
  onClick,
  onDelete,
  onDuplicate,
  onRotate,
  onAddAfter,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageIndex: number;
  active: boolean;
  selectMode: boolean;
  checked: boolean;
  isDragOver: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onDuplicate: () => void;
  onRotate: () => void;
  onAddAfter: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    setRendered(false);
  }, [pdfDoc, pageIndex]);

  useEffect(() => {
    if (!canvasRef.current || rendered) return;
    renderPage(pdfDoc, pageIndex, canvasRef.current, THUMB_SCALE).then(() => setRendered(true));
  }, [pdfDoc, pageIndex, rendered]);

  return (
    <div
      className={`thumb-item ${active ? "is-active" : ""} ${isDragOver ? "is-drag-over" : ""}`}
      draggable={!selectMode}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <button className="thumb-btn" onClick={onClick} title={`Page ${pageIndex + 1}`}>
        {selectMode && (
          <input type="checkbox" className="thumb-checkbox" checked={checked} readOnly onClick={(e) => e.stopPropagation()} />
        )}
        <canvas ref={canvasRef} className="thumb-canvas" />
      </button>
      <div className="thumb-footer">
        <span className="thumb-label">{pageIndex + 1}</span>
        {!selectMode && (
          <div className="thumb-actions">
            <button className="thumb-action" title="Add blank page after this" onClick={(e) => (e.stopPropagation(), onAddAfter())}>
              <Plus size={12} strokeWidth={2} />
            </button>
            <button className="thumb-action" title="Duplicate page" onClick={(e) => (e.stopPropagation(), onDuplicate())}>
              <Copy size={12} strokeWidth={1.75} />
            </button>
            <button className="thumb-action" title="Rotate 90°" onClick={(e) => (e.stopPropagation(), onRotate())}>
              <RotateCw size={12} strokeWidth={1.75} />
            </button>
            {onDelete && (
              <button
                className="thumb-action danger"
                title="Delete page"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete page ${pageIndex + 1}? This can't be undone.`)) onDelete();
                }}
              >
                <Trash2 size={12} strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}
      </div>
      <style>{`
        .thumb-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .thumb-item.is-drag-over {
          outline: 2px dashed var(--accent-blue);
          outline-offset: 2px;
          border-radius: var(--radius-sm);
        }
        .thumb-btn {
          all: unset;
          cursor: pointer;
          display: block;
          position: relative;
          width: 100%;
          border-radius: var(--radius-sm);
          border: 2px solid transparent;
          overflow: hidden;
        }
        .thumb-item.is-active .thumb-btn {
          border-color: var(--accent-blue);
        }
        .thumb-item:not(.is-active) .thumb-btn:hover {
          border-color: var(--border-strong);
        }
        .thumb-checkbox {
          position: absolute;
          top: 4px;
          left: 4px;
          z-index: 2;
        }
        .thumb-canvas {
          width: 100%;
          height: auto;
          display: block;
          background: var(--bg-panel);
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
        }
        .thumb-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2px;
        }
        .thumb-label {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-tertiary);
        }
        .thumb-actions {
          display: flex;
          gap: 2px;
        }
        .thumb-action {
          all: unset;
          cursor: pointer;
          color: var(--text-tertiary);
          display: flex;
          padding: 2px;
          border-radius: 3px;
        }
        .thumb-action:hover {
          color: var(--accent-blue);
          background: var(--accent-blue-soft);
        }
        .thumb-action.danger:hover {
          color: var(--danger);
          background: var(--danger-soft);
        }
      `}</style>
    </div>
  );
}
