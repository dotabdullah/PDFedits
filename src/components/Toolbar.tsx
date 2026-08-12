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
  onOpen: () => void;
  onZoom: (z: number) => void;
  onPage: (p: number) => void;
  onExport: (format: "pdf" | "png" | "jpg") => void;
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
  onOpen,
  onZoom,
  onPage,
  onExport,
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
        <span className="file-name">{fileName ?? "No file open"}</span>
      </div>

      {numPages > 0 && (
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

      <div className="top-bar-right">
        <button className="btn-ghost" onClick={onSaveProject} disabled={numPages === 0} title="Save edits + PDF as a reopenable project file">
          Save project
        </button>
        <button className="btn-primary" onClick={() => onExport("pdf")} disabled={numPages === 0}>
          Save PDF
        </button>
        <button className="btn-ghost" onClick={() => onExport("png")} disabled={numPages === 0}>
          PNG
        </button>
        <button className="btn-ghost" onClick={() => onExport("jpg")} disabled={numPages === 0}>
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
