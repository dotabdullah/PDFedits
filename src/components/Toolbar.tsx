import { ToolId } from "../lib/types";

const TOOLS: { id: ToolId; label: string; glyph: string }[] = [
  { id: "select", label: "Select / edit text (V)", glyph: "↖" },
  { id: "text", label: "Add text (T)", glyph: "T" },
  { id: "image", label: "Add image (I)", glyph: "▣" },
  { id: "signature", label: "Signature (S)", glyph: "✎" },
  { id: "erase", label: "Erase (E)", glyph: "▢" },
];

interface RailProps {
  activeTool: ToolId;
  onSelectTool: (t: ToolId) => void;
}

export function ToolRail({ activeTool, onSelectTool }: RailProps) {
  return (
    <nav className="tool-rail" aria-label="Editing tools">
      <div className="rail-mark">Pe</div>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`rail-btn ${activeTool === t.id ? "is-active" : ""}`}
          onClick={() => onSelectTool(t.id)}
          title={t.label}
          aria-pressed={activeTool === t.id}
        >
          <span aria-hidden="true">{t.glyph}</span>
        </button>
      ))}
      <style>{`
        .tool-rail {
          grid-area: rail;
          background: var(--ink-900);
          border-right: 1px solid var(--ink-700);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 0;
          gap: 6px;
        }
        .rail-mark {
          font-family: var(--font-display);
          font-size: 20px;
          color: var(--accent-amber);
          margin-bottom: 14px;
        }
        .rail-btn {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          border: none;
          background: transparent;
          color: var(--text-on-ink-dim);
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 120ms ease, color 120ms ease;
        }
        .rail-btn:hover {
          background: var(--ink-700);
          color: var(--text-on-ink);
        }
        .rail-btn.is-active {
          background: var(--accent-amber);
          color: var(--ink-900);
        }
      `}</style>
    </nav>
  );
}

interface TopBarProps {
  fileName: string | null;
  zoom: number;
  currentPage: number;
  numPages: number;
  canUndo: boolean;
  canRedo: boolean;
  canReset: boolean;
  activeTool: ToolId;
  eraseWidth: number;
  eraseThickness: number;
  onEraseWidthChange: (w: number) => void;
  onEraseThicknessChange: (h: number) => void;
  onOpen: () => void;
  onClose: () => void;
  onReset: () => void;
  onZoom: (z: number) => void;
  onPage: (p: number) => void;
  onSavePdf: () => void;
  onSavePdfAs: () => void;
  onExportImage: (format: "png" | "jpg") => void;
  onUndo: () => void;
  onRedo: () => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
}

export function TopBar({
  fileName,
  zoom,
  currentPage,
  numPages,
  canUndo,
  canRedo,
  canReset,
  activeTool,
  eraseWidth,
  eraseThickness,
  onEraseWidthChange,
  onEraseThicknessChange,
  onOpen,
  onClose,
  onReset,
  onZoom,
  onPage,
  onSavePdf,
  onSavePdfAs,
  onExportImage,
  onUndo,
  onRedo,
  onSaveProject,
  onOpenProject,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button className="btn-ghost" onClick={onOpen}>
          Open PDF
        </button>
        <button className="btn-ghost" onClick={onOpenProject} title="Open a saved .pdfedits project">
          Open project
        </button>
        {numPages > 0 && (
          <button className="btn-ghost" onClick={onClose} title="Close this PDF">
            Close
          </button>
        )}
        <span className="file-name">{fileName ?? "No file open"}</span>
      </div>

      {numPages > 0 && activeTool !== "erase" && (
        <div className="top-bar-center">
          <button className="btn-ghost sm" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button className="btn-ghost sm" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
            ↷
          </button>
          <span className="divider" />
          <button className="btn-ghost sm" onClick={() => onPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}>
            ←
          </button>
          <span className="page-indicator">
            {currentPage + 1} / {numPages}
          </span>
          <button className="btn-ghost sm" onClick={() => onPage(Math.min(numPages - 1, currentPage + 1))} disabled={currentPage === numPages - 1}>
            →
          </button>
          <span className="divider" />
          <button className="btn-ghost sm" onClick={() => onZoom(Math.max(0.5, zoom - 0.1))}>
            −
          </button>
          <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
          <button className="btn-ghost sm" onClick={() => onZoom(Math.min(2.5, zoom + 0.1))}>
            +
          </button>
        </div>
      )}

      {numPages > 0 && activeTool === "erase" && (
        <div className="top-bar-center erase-controls">
          <label className="erase-slider">
            <span>Width</span>
            <input type="range" min={20} max={400} value={eraseWidth} onChange={(e) => onEraseWidthChange(Number(e.target.value))} />
            <span className="erase-value">{eraseWidth}px</span>
          </label>
          <label className="erase-slider">
            <span>Thickness</span>
            <input type="range" min={8} max={80} value={eraseThickness} onChange={(e) => onEraseThicknessChange(Number(e.target.value))} />
            <span className="erase-value">{eraseThickness}px</span>
          </label>
          <span className="erase-hint">Click your own text/image/signature to delete it — click PDF content to patch it</span>
        </div>
      )}

      <div className="top-bar-right">
        <button className="btn-ghost" onClick={onReset} disabled={!canReset} title="Remove every edit made on this PDF">
          Reset edits
        </button>
        <button className="btn-ghost" onClick={onSaveProject} disabled={numPages === 0} title="Save edits + PDF as a reopenable project file">
          Save project
        </button>
        <button className="btn-primary" onClick={onSavePdf} disabled={numPages === 0} title="Save (reuses the last location this session, or asks like Save As if none yet)">
          Save PDF
        </button>
        <button className="btn-ghost" onClick={onSavePdfAs} disabled={numPages === 0} title="Always asks where to save">
          Save As…
        </button>
        <button className="btn-ghost" onClick={() => onExportImage("png")} disabled={numPages === 0}>
          PNG
        </button>
        <button className="btn-ghost" onClick={() => onExportImage("jpg")} disabled={numPages === 0}>
          JPG
        </button>
      </div>

      <style>{`
        .top-bar {
          grid-area: topbar;
          background: var(--ink-900);
          border-bottom: 1px solid var(--ink-700);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          gap: 16px;
        }
        .top-bar-left, .top-bar-center, .top-bar-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .file-name {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-on-ink-dim);
          max-width: 240px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .page-indicator, .zoom-indicator {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-on-ink-dim);
          min-width: 52px;
          text-align: center;
        }
        .divider {
          width: 1px;
          height: 20px;
          background: var(--ink-700);
          margin: 0 4px;
        }
        .erase-controls {
          gap: 16px;
        }
        .erase-slider {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-on-ink-dim);
        }
        .erase-slider input[type="range"] {
          width: 90px;
          accent-color: var(--accent-amber);
        }
        .erase-value {
          min-width: 34px;
        }
        .erase-hint {
          font-size: 11px;
          color: var(--text-on-ink-dim);
          font-style: italic;
        }
        .btn-primary, .btn-ghost {
          font-family: var(--font-ui);
          font-weight: 600;
          font-size: 13px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: opacity 120ms ease, background 120ms ease;
        }
        .btn-primary {
          background: var(--accent-amber);
          color: var(--ink-900);
          border: none;
          padding: 8px 16px;
        }
        .btn-primary:hover { background: var(--accent-amber-dim); }
        .btn-ghost {
          background: transparent;
          color: var(--text-on-ink);
          border: 1px solid var(--ink-700);
          padding: 7px 14px;
        }
        .btn-ghost.sm { padding: 4px 8px; }
        .btn-ghost:hover { border-color: var(--accent-amber); }
        .btn-primary:disabled, .btn-ghost:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </header>
  );
}
