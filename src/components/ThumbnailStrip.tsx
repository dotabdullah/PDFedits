import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { renderPage } from "../lib/pdfEngine";

const THUMB_SCALE = 0.18;

interface Props {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  onSelectPage: (index: number) => void;
}

export function ThumbnailStrip({ pdfDoc, numPages, currentPage, onSelectPage }: Props) {
  return (
    <div className="thumb-strip">
      {Array.from({ length: numPages }, (_, i) => (
        <Thumbnail key={i} pdfDoc={pdfDoc} pageIndex={i} active={i === currentPage} onClick={() => onSelectPage(i)} />
      ))}
      <style>{`
        .thumb-strip {
          position: absolute;
          left: var(--rail-width);
          top: var(--topbar-height);
          bottom: 0;
          width: 96px;
          overflow-y: auto;
          background: var(--ink-900);
          border-right: 1px solid var(--ink-700);
          padding: 12px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          z-index: 5;
        }
        @media (max-width: 860px) {
          .thumb-strip { display: none; }
        }
      `}</style>
    </div>
  );
}

function Thumbnail({
  pdfDoc,
  pageIndex,
  active,
  onClick,
}: {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageIndex: number;
  active: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || rendered) return;
    renderPage(pdfDoc, pageIndex, canvasRef.current, THUMB_SCALE).then(() => setRendered(true));
  }, [pdfDoc, pageIndex, rendered]);

  return (
    <button className={`thumb-btn ${active ? "is-active" : ""}`} onClick={onClick} title={`Page ${pageIndex + 1}`}>
      <canvas ref={canvasRef} className="thumb-canvas" />
      <span className="thumb-label">{pageIndex + 1}</span>
      <style>{`
        .thumb-btn {
          all: unset;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          width: 100%;
          padding: 4px;
          border-radius: var(--radius-sm);
          border: 2px solid transparent;
        }
        .thumb-btn.is-active {
          border-color: var(--accent-amber);
        }
        .thumb-btn:hover:not(.is-active) {
          border-color: var(--ink-700);
        }
        .thumb-canvas {
          width: 100%;
          height: auto;
          background: var(--paper-100);
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        }
        .thumb-label {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-on-ink-dim);
        }
      `}</style>
    </button>
  );
}
