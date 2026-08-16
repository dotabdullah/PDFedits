import { AlignCenter, AlignLeft, AlignRight, Copy, SendToBack, BringToFront, Trash2 } from "lucide-react";
import type { EditorElement, EllipseElement, LineElement, RectangleElement, TextElement } from "../lib/types";

export interface DocInfo {
  fileName: string;
  numPages: number;
  currentPage: number;
}

interface Props {
  selected: EditorElement | null;
  docInfo: DocInfo | null;
  onUpdate: (id: string, patch: Partial<EditorElement>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
}

export function SidePanel({ selected, docInfo, onUpdate, onDelete, onDuplicate, onBringToFront, onSendToBack }: Props) {
  return (
    <aside className="side-panel">
      <h2 className="panel-title">Properties</h2>

      {!selected && !docInfo && <p className="panel-empty">Open a PDF to see document info</p>}

      {!selected && docInfo && (
        <div className="doc-info">
          <InfoRow label="File" value={docInfo.fileName} />
          <InfoRow label="Pages" value={String(docInfo.numPages)} />
          <InfoRow label="Current page" value={String(docInfo.currentPage + 1)} />
          <p className="panel-hint">Select an element on the page to edit it, or pick a tool to add something new.</p>
        </div>
      )}

      {selected?.kind === "text" && <TextProps el={selected} onUpdate={onUpdate} />}
      {(selected?.kind === "rectangle" || selected?.kind === "ellipse") && <ShapeProps el={selected} onUpdate={onUpdate} />}
      {selected?.kind === "line" && <LineProps el={selected} onUpdate={onUpdate} />}

      {selected && (selected.kind === "image" || selected.kind === "signature" || selected.kind === "erase") && (
        <div className="field-group">
          <label className="field-label">Position</label>
          <div className="field-row">
            <NumberField label="X" value={Math.round(selected.x)} onChange={(v) => onUpdate(selected.id, { x: v })} />
            <NumberField label="Y" value={Math.round(selected.y)} onChange={(v) => onUpdate(selected.id, { y: v })} />
          </div>
          <label className="field-label">Size</label>
          <div className="field-row">
            <NumberField label="W" value={Math.round(selected.width)} onChange={(v) => onUpdate(selected.id, { width: v })} />
            <NumberField label="H" value={Math.round(selected.height)} onChange={(v) => onUpdate(selected.id, { height: v })} />
          </div>
          {selected.kind !== "erase" && <RotationField el={selected} onUpdate={onUpdate} />}
        </div>
      )}

      {selected && (
        <div className="field-group">
          <label className="field-label">Arrange</label>
          <div className="arrange-row">
            <button className="btn-secondary" onClick={() => onBringToFront(selected.id)} title="Bring to front">
              <BringToFront size={14} /> Front
            </button>
            <button className="btn-secondary" onClick={() => onSendToBack(selected.id)} title="Send to back">
              <SendToBack size={14} /> Back
            </button>
          </div>
          <button className="btn-secondary full" onClick={() => onDuplicate(selected.id)} title="Duplicate (Ctrl+D)">
            <Copy size={14} /> Duplicate
          </button>
        </div>
      )}

      {selected && (
        <button className="btn-danger" onClick={() => onDelete(selected.id)}>
          <Trash2 size={14} /> Delete element
        </button>
      )}

      <style>{`
        .side-panel {
          grid-area: properties;
          background: var(--bg-panel);
          border-left: 1px solid var(--border);
          padding: 16px;
          overflow-y: auto;
        }
        .panel-title {
          font-size: 13px;
          font-weight: 700;
          margin: 0 0 14px;
          color: var(--text-primary);
        }
        .panel-empty {
          font-size: 12.5px;
          color: var(--text-tertiary);
          line-height: 1.5;
        }
        .panel-hint {
          font-size: 12px;
          color: var(--text-tertiary);
          line-height: 1.5;
          margin-top: 14px;
        }
        .doc-info { display: flex; flex-direction: column; }
        .field-group { margin-bottom: 18px; }
        .field-label {
          display: block;
          font-family: var(--font-mono);
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-tertiary);
          margin: 12px 0 6px;
        }
        .field-row { display: flex; gap: 8px; }
        .arrange-row { display: flex; gap: 8px; margin-bottom: 8px; }
        .btn-secondary {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px;
          background: var(--bg-canvas);
          border: 1px solid var(--border);
          color: var(--text-primary);
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-secondary:hover { border-color: var(--border-strong); }
        .btn-secondary.full { width: 100%; }
        .btn-danger {
          width: 100%;
          margin-top: 8px;
          padding: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: transparent;
          border: 1px solid var(--danger);
          color: var(--danger);
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 12.5px;
          cursor: pointer;
        }
        .btn-danger:hover { background: var(--danger-soft); }
      `}</style>
    </aside>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
      <style>{`
        .info-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          font-size: 12.5px;
        }
        .info-label { color: var(--text-tertiary); }
        .info-value { color: var(--text-primary); font-weight: 500; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
      `}</style>
    </div>
  );
}

function RotationField({ el, onUpdate }: { el: EditorElement; onUpdate: Props["onUpdate"] }) {
  return (
    <>
      <label className="field-label">Rotation</label>
      <div className="rotation-row">
        <input
          type="range"
          min={0}
          max={359}
          value={el.rotation ?? 0}
          onChange={(e) => onUpdate(el.id, { rotation: Number(e.target.value) })}
        />
        <span className="rotation-value">{el.rotation ?? 0}°</span>
      </div>
      <style>{`
        .rotation-row { display: flex; align-items: center; gap: 8px; }
        .rotation-row input[type="range"] { flex: 1; }
        .rotation-value { font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); min-width: 32px; text-align: right; }
      `}</style>
    </>
  );
}

function TextProps({ el, onUpdate }: { el: TextElement; onUpdate: Props["onUpdate"] }) {
  return (
    <div className="field-group">
      <label className="field-label">Font size</label>
      <input
        type="range"
        min={8}
        max={72}
        value={el.fontSize}
        onChange={(e) => onUpdate(el.id, { fontSize: Number(e.target.value) })}
      />
      <label className="field-label">Font</label>
      <select value={el.fontFamily} onChange={(e) => onUpdate(el.id, { fontFamily: e.target.value as TextElement["fontFamily"] })}>
        <option value="sans">Sans</option>
        <option value="serif">Serif</option>
        <option value="mono">Mono</option>
      </select>
      <label className="field-label">Style</label>
      <div className="style-toggles">
        <button type="button" className={`toggle-btn ${el.bold ? "is-on" : ""}`} onClick={() => onUpdate(el.id, { bold: !el.bold })}>
          B
        </button>
        <button type="button" className={`toggle-btn italic-btn ${el.italic ? "is-on" : ""}`} onClick={() => onUpdate(el.id, { italic: !el.italic })}>
          I
        </button>
        <button type="button" className={`toggle-btn underline-btn ${el.underline ? "is-on" : ""}`} onClick={() => onUpdate(el.id, { underline: !el.underline })}>
          U
        </button>
      </div>
      <label className="field-label">Alignment</label>
      <div className="style-toggles">
        <button type="button" className={`toggle-btn ${(el.align ?? "left") === "left" ? "is-on" : ""}`} onClick={() => onUpdate(el.id, { align: "left" })}>
          <AlignLeft size={14} />
        </button>
        <button type="button" className={`toggle-btn ${el.align === "center" ? "is-on" : ""}`} onClick={() => onUpdate(el.id, { align: "center" })}>
          <AlignCenter size={14} />
        </button>
        <button type="button" className={`toggle-btn ${el.align === "right" ? "is-on" : ""}`} onClick={() => onUpdate(el.id, { align: "right" })}>
          <AlignRight size={14} />
        </button>
      </div>
      <label className="field-label">Color</label>
      <input type="color" value={el.color} onChange={(e) => onUpdate(el.id, { color: e.target.value })} />
      <RotationField el={el} onUpdate={onUpdate} />
      <style>{sharedFieldStyles}</style>
    </div>
  );
}

function ShapeProps({ el, onUpdate }: { el: RectangleElement | EllipseElement; onUpdate: Props["onUpdate"] }) {
  return (
    <div className="field-group">
      <label className="field-label">Stroke color</label>
      <input type="color" value={el.strokeColor} onChange={(e) => onUpdate(el.id, { strokeColor: e.target.value })} />
      <label className="field-label">Stroke width</label>
      <input type="range" min={1} max={12} value={el.strokeWidth} onChange={(e) => onUpdate(el.id, { strokeWidth: Number(e.target.value) })} />
      <label className="field-label">Fill</label>
      <div className="fill-row">
        <input
          type="checkbox"
          checked={el.fillColor !== null}
          onChange={(e) => onUpdate(el.id, { fillColor: e.target.checked ? "#eaf1fe" : null })}
        />
        <input
          type="color"
          value={el.fillColor ?? "#eaf1fe"}
          disabled={el.fillColor === null}
          onChange={(e) => onUpdate(el.id, { fillColor: e.target.value })}
        />
      </div>
      <label className="field-label">Position</label>
      <div className="field-row">
        <NumberField label="X" value={Math.round(el.x)} onChange={(v) => onUpdate(el.id, { x: v })} />
        <NumberField label="Y" value={Math.round(el.y)} onChange={(v) => onUpdate(el.id, { y: v })} />
      </div>
      <label className="field-label">Size</label>
      <div className="field-row">
        <NumberField label="W" value={Math.round(el.width)} onChange={(v) => onUpdate(el.id, { width: v })} />
        <NumberField label="H" value={Math.round(el.height)} onChange={(v) => onUpdate(el.id, { height: v })} />
      </div>
      <RotationField el={el} onUpdate={onUpdate} />
      <style>{`
        ${sharedFieldStyles}
        .fill-row { display: flex; align-items: center; gap: 8px; }
      `}</style>
    </div>
  );
}

function LineProps({ el, onUpdate }: { el: LineElement; onUpdate: Props["onUpdate"] }) {
  return (
    <div className="field-group">
      <label className="field-label">Color</label>
      <input type="color" value={el.strokeColor} onChange={(e) => onUpdate(el.id, { strokeColor: e.target.value })} />
      <label className="field-label">Thickness</label>
      <input type="range" min={1} max={12} value={el.strokeWidth} onChange={(e) => onUpdate(el.id, { strokeWidth: Number(e.target.value) })} />
      <style>{sharedFieldStyles}</style>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <style>{`
        .number-field { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--text-tertiary); flex: 1; }
        .number-field input {
          background: var(--bg-canvas);
          border: 1px solid var(--border);
          color: var(--text-primary);
          border-radius: var(--radius-sm);
          padding: 6px 8px;
          font-family: var(--font-mono);
          font-size: 12px;
          width: 100%;
        }
      `}</style>
    </label>
  );
}

const sharedFieldStyles = `
  .style-toggles { display: flex; gap: 6px; }
  .toggle-btn {
    width: 32px; height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-canvas);
    border: 1px solid var(--border);
    color: var(--text-primary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-ui);
    font-size: 13px;
  }
  .italic-btn { font-style: italic; }
  .underline-btn { text-decoration: underline; }
  .toggle-btn.is-on {
    background: var(--accent-blue-soft);
    border-color: var(--accent-blue);
    color: var(--accent-blue);
  }
  select {
    width: 100%;
    background: var(--bg-canvas);
    border: 1px solid var(--border);
    color: var(--text-primary);
    border-radius: var(--radius-sm);
    padding: 7px 8px;
    font-size: 12.5px;
    font-family: var(--font-ui);
  }
`;
