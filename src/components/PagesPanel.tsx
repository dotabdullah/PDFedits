import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Trash2, FileText } from "lucide-react";
import { renderPage } from "../lib/pdfEngine";

const THUMB_SCALE = 0.16;

interface Props {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  numPages: number;
  currentPage: number;
  onSelectPage: (index: number) => void;
  onDeletePage: (index: number) => void;
}

export function PagesPanel({ pdfDoc, numPages, currentPage, onSelectPage, onDeletePage }: Props) {
  return (
    <aside className="pages-panel">
      <div className="pages-header">Pages ({numPages})</div>
      <div className="pages-list">
        {!pdfDoc || numPages === 0 ? (
          <div className="pages-empty">
            <FileText size={28} strokeWidth={1.5} />
            <span>No pages</span>
          </div>
        ) : (
          Array.from({ length: numPages }, (_, i) => (
            <Thumbnail
              key={i}
              pdfDoc={pdfDoc}
              pageIndex={i}
              active={i === currentPage}
              onClick={() => onSelectPage(i)}
              onDelete={numPages > 1 ? () => onDeletePage(i) : undefined}
            />
          ))
        )}
      </div>
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
      `}</style>
    </aside>
  );
}

function Thumbnail({
  pdfDoc,
  pageIndex,
  active,
  onClick,
  onDelete,
}: {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageIndex: number;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    setRendered(false);
  }, [pdfDoc]);

  useEffect(() => {
    if (!canvasRef.current || rendered) return;
    renderPage(pdfDoc, pageIndex, canvasRef.current, THUMB_SCALE).then(() => setRendered(true));
  }, [pdfDoc, pageIndex, rendered]);

  return (
    <div className={`thumb-item ${active ? "is-active" : ""}`}>
      <button className="thumb-btn" onClick={onClick} title={`Page ${pageIndex + 1}`}>
        <canvas ref={canvasRef} className="thumb-canvas" />
      </button>
      <div className="thumb-footer">
        <span className="thumb-label">{pageIndex + 1}</span>
        {onDelete && (
          <button
            className="thumb-delete"
            title="Delete page"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete page ${pageIndex + 1}? This can't be undone.`)) onDelete();
            }}
          >
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <style>{`
        .thumb-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .thumb-btn {
          all: unset;
          cursor: pointer;
          display: block;
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
        .thumb-delete {
          all: unset;
          cursor: pointer;
          color: var(--text-tertiary);
          display: flex;
          padding: 2px;
          border-radius: 3px;
        }
        .thumb-delete:hover {
          color: var(--danger);
          background: var(--danger-soft);
        }
      `}</style>
    </div>
  );
}
