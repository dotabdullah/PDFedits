import { useEffect, useState } from "react";
import {
  FolderOpen,
  Save,
  FileDown,
  Undo2,
  Redo2,
  Search,
  Settings,
  MousePointer2,
  Hand,
  Type,
  Image as ImageIcon,
  PenTool,
  Square,
  Circle,
  Minus,
  Eraser,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ZoomOut,
  ZoomIn,
  Maximize,
  Minimize,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { ToolId, ZoomMode } from "../lib/types";

interface HeaderBarProps {
  fileName: string | null;
  numPages: number;
  canUndo: boolean;
  canRedo: boolean;
  onOpen: () => void;
  onOpenProject: () => void;
  onClose: () => void;
  onSavePdf: () => void;
  onSavePdfAs: () => void;
  onSaveProject: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSearch: () => void;
  onToggleSettings: () => void;
}

export function HeaderBar({
  fileName,
  numPages,
  canUndo,
  canRedo,
  onOpen,
  onOpenProject,
  onClose,
  onSavePdf,
  onSavePdfAs,
  onSaveProject,
  onUndo,
  onRedo,
  onToggleSearch,
  onToggleSettings,
}: HeaderBarProps) {
  return (
    <header className="header-bar">
      <div className="brand">
        <div className="brand-mark">
          <FolderOpen size={16} strokeWidth={2} />
        </div>
        <div className="brand-text">
          <span className="brand-name">PDFedits</span>
          <span className="brand-sub">Studio</span>
        </div>
      </div>

      <div className="header-actions">
        <button className="hbtn" onClick={onOpen} title="Open a PDF (Ctrl+O)">
          <FolderOpen size={15} /> Open
        </button>
        <button className="hbtn" onClick={onOpenProject} title="Open a saved .pdfedits project">
          <FolderOpen size={15} /> Open Project
        </button>
        {numPages > 0 && (
          <button className="hbtn" onClick={onClose} title="Close this PDF">
            <XCircle size={15} /> Close
          </button>
        )}
        <span className="hdivider" />
        <button className="hbtn" onClick={onSavePdf} disabled={numPages === 0} title="Save (reuses last location, or Save As if none yet)">
          <Save size={15} /> Save
        </button>
        <button className="hbtn" onClick={onSavePdfAs} disabled={numPages === 0} title="Always asks where to save">
          <FileDown size={15} /> Save As
        </button>
        <button className="hbtn" onClick={onSaveProject} disabled={numPages === 0} title="Save edits + PDF as a reopenable project file">
          <Save size={15} /> Save Project
        </button>
        <span className="hdivider" />
        <button className="hbtn icon-only" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={16} />
        </button>
        <button className="hbtn icon-only" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={16} />
        </button>
      </div>

      <div className="header-status">{fileName ?? "No document open"}</div>

      <div className="header-right">
        <button className="hicon" onClick={onToggleSearch} title="Find in document" disabled={numPages === 0}>
          <Search size={16} />
        </button>
        <button className="hicon" onClick={onToggleSettings} title="Settings & about">
          <Settings size={16} />
        </button>
      </div>

      <style>{`
        .header-bar {
          grid-area: header;
          background: var(--bg-panel);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 0 14px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .brand-mark {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: var(--accent-blue-soft);
          color: var(--accent-blue);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .brand-text {
          display: flex;
          flex-direction: column;
          line-height: 1.05;
        }
        .brand-name {
          font-size: 14px;
          font-weight: 800;
          color: var(--text-primary);
        }
        .brand-sub {
          font-size: 10px;
          color: var(--text-tertiary);
          font-weight: 600;
          letter-spacing: 0.03em;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .hbtn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 12.5px;
          font-weight: 500;
          padding: 6px 9px;
          border-radius: var(--radius-sm);
          cursor: pointer;
        }
        .hbtn:hover:not(:disabled) { background: var(--bg-canvas); }
        .hbtn:disabled { color: var(--text-tertiary); cursor: not-allowed; }
        .hbtn.icon-only { padding: 6px; }
        .hdivider {
          width: 1px;
          height: 18px;
          background: var(--border);
          margin: 0 4px;
        }
        .header-status {
          flex: 1;
          text-align: center;
          font-size: 12px;
          color: var(--text-tertiary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .hicon {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 7px;
          border-radius: var(--radius-sm);
          display: flex;
          cursor: pointer;
        }
        .hicon:hover:not(:disabled) { background: var(--bg-canvas); color: var(--text-primary); }
        .hicon:disabled { color: var(--text-tertiary); cursor: not-allowed; opacity: 0.5; }
      `}</style>
    </header>
  );
}

const TOOLS: { id: ToolId; label: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select / edit text (V)", icon: <MousePointer2 size={16} /> },
  { id: "pan", label: "Pan (H)", icon: <Hand size={16} /> },
  { id: "text", label: "Add text (T)", icon: <Type size={16} /> },
  { id: "image", label: "Add image (I)", icon: <ImageIcon size={16} /> },
  { id: "signature", label: "Signature (S)", icon: <PenTool size={16} /> },
  { id: "rectangle", label: "Rectangle (R)", icon: <Square size={16} /> },
  { id: "ellipse", label: "Ellipse (O)", icon: <Circle size={16} /> },
  { id: "line", label: "Line (L)", icon: <Minus size={16} /> },
  { id: "erase", label: "Erase (E)", icon: <Eraser size={16} /> },
];

interface ToolsBarProps {
  activeTool: ToolId;
  onSelectTool: (t: ToolId) => void;
  currentPage: number;
  numPages: number;
  onPage: (p: number) => void;
  onGoToPage: (n: number) => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  zoom: number;
  zoomMode: ZoomMode;
  onZoomStep: (delta: number) => void;
  onZoomPercent: (percent: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  onActualSize: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  eraseWidth: number;
  eraseThickness: number;
  onEraseWidthChange: (w: number) => void;
  onEraseThicknessChange: (h: number) => void;
  canReset: boolean;
  onReset: () => void;
}

export function ToolsBar({
  activeTool,
  onSelectTool,
  currentPage,
  numPages,
  onPage,
  onGoToPage,
  onFirstPage,
  onLastPage,
  zoom,
  zoomMode,
  onZoomStep,
  onZoomPercent,
  onFitWidth,
  onFitPage,
  onActualSize,
  isFullscreen,
  onToggleFullscreen,
  eraseWidth,
  eraseThickness,
  onEraseWidthChange,
  onEraseThicknessChange,
  canReset,
  onReset,
}: ToolsBarProps) {
  const [pageInput, setPageInput] = useState(String(currentPage + 1));
  useEffect(() => setPageInput(String(currentPage + 1)), [currentPage]);

  return (
    <div className="tools-bar">
      <div className="tools-group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`tbtn ${activeTool === t.id ? "is-active" : ""}`}
            onClick={() => onSelectTool(t.id)}
            title={t.label}
            disabled={numPages === 0}
            aria-pressed={activeTool === t.id}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {activeTool === "erase" && numPages > 0 && (
        <div className="erase-controls">
          <label className="erase-slider">
            <span>Width</span>
            <input type="range" min={20} max={400} value={eraseWidth} onChange={(e) => onEraseWidthChange(Number(e.target.value))} />
          </label>
          <label className="erase-slider">
            <span>Thickness</span>
            <input type="range" min={8} max={80} value={eraseThickness} onChange={(e) => onEraseThicknessChange(Number(e.target.value))} />
          </label>
        </div>
      )}

      <span className="tools-spacer" />

      <button className="tbtn" onClick={onReset} disabled={!canReset} title="Reset all edits">
        <RotateCcw size={16} />
      </button>

      {numPages > 0 && (
        <>
          <span className="tdivider" />
          <button className="tbtn" onClick={onFirstPage} disabled={currentPage === 0} title="First page">
            <ChevronsLeft size={16} />
          </button>
          <button className="tbtn" onClick={() => onPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} title="Previous page">
            <ChevronLeft size={16} />
          </button>
          <form
            className="page-goto"
            onSubmit={(e) => {
              e.preventDefault();
              onGoToPage(Number(pageInput));
            }}
          >
            <input
              className="page-input"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => onGoToPage(Number(pageInput))}
              inputMode="numeric"
            />
            <span>/ {numPages}</span>
          </form>
          <button className="tbtn" onClick={() => onPage(Math.min(numPages - 1, currentPage + 1))} disabled={currentPage === numPages - 1} title="Next page">
            <ChevronRight size={16} />
          </button>
          <button className="tbtn" onClick={onLastPage} disabled={currentPage === numPages - 1} title="Last page">
            <ChevronsRight size={16} />
          </button>
          <span className="tdivider" />
          <button className="tbtn" onClick={() => onZoomStep(-0.1)} title="Zoom out">
            <ZoomOut size={16} />
          </button>
          <select
            className="zoom-select"
            value={zoomMode === "custom" ? "custom" : zoomMode}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "fit-width") onFitWidth();
              else if (v === "fit-page") onFitPage();
              else if (v === "actual") onActualSize();
            }}
          >
            <option value="custom">{Math.round(zoom * 100)}%</option>
            <option value="fit-width">Fit Width</option>
            <option value="fit-page">Fit Page</option>
            <option value="actual">Actual Size</option>
          </select>
          <button className="tbtn" onClick={() => onZoomStep(0.1)} title="Zoom in">
            <ZoomIn size={16} />
          </button>
          <button className="tbtn" onClick={onToggleFullscreen} title="Toggle fullscreen">
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </>
      )}

      <style>{`
        .tools-bar {
          grid-area: tools;
          background: var(--bg-panel);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          overflow-x: auto;
        }
        .tools-group {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .tbtn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          cursor: pointer;
          flex-shrink: 0;
        }
        .tbtn:hover:not(:disabled) { background: var(--bg-canvas); color: var(--text-primary); }
        .tbtn.is-active { background: var(--accent-blue-soft); color: var(--accent-blue); }
        .tbtn:disabled { color: var(--text-tertiary); opacity: 0.45; cursor: not-allowed; }
        .tdivider {
          width: 1px;
          height: 20px;
          background: var(--border);
          flex-shrink: 0;
        }
        .tools-spacer { flex: 1; }
        .page-goto {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-secondary);
          flex-shrink: 0;
        }
        .page-input {
          width: 32px;
          text-align: center;
          font-family: var(--font-mono);
          font-size: 11px;
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 3px 2px;
          color: var(--text-primary);
          background: var(--bg-panel);
        }
        .zoom-select {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-secondary);
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 4px 4px;
          min-width: 92px;
          flex-shrink: 0;
        }
        .erase-controls {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-left: 10px;
          border-left: 1px solid var(--border);
        }
        .erase-slider {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 10.5px;
          color: var(--text-secondary);
          white-space: nowrap;
        }
        .erase-slider input[type="range"] {
          width: 80px;
          accent-color: var(--accent-blue);
        }
      `}</style>
    </div>
  );
}
