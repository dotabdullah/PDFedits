import type { EditorElement, TextElement } from "../lib/types";

interface Props {
  selected: EditorElement | null;
  onUpdate: (id: string, patch: Partial<EditorElement>) => void;
  onDelete: (id: string) => void;
}

export function SidePanel({ selected, onUpdate, onDelete }: Props) {
  return (
    <aside className="side-panel">
      <h2 className="panel-title">Properties</h2>

      {!selected && <p className="panel-empty">Select an element on the page to edit it, or pick a tool to add something new.</p>}

      {selected?.kind === "text" && <TextProps el={selected} onUpdate={onUpdate} />}

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
        </div>
      )}

      {selected && (
        <button className="btn-danger" onClick={() => onDelete(selected.id)}>
          Delete element
        </button>
      )}

      <style>{`
        .side-panel {
          grid-area: panel;
          background: var(--ink-900);
          border-left: 1px solid var(--ink-700);
          padding: 20px 18px;
          overflow-y: auto;
        }
        .panel-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 14px;
          color: var(--text-on-ink);
        }
        .panel-empty {
          font-size: 13px;
          color: var(--text-on-ink-dim);
          line-height: 1.5;
        }
        .field-group { margin-bottom: 18px; }
        .field-label {
          display: block;
          font-family: var(--font-mono);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-on-ink-dim);
          margin: 12px 0 6px;
        }
        .field-row { display: flex; gap: 8px; }
        .btn-danger {
          width: 100%;
          margin-top: 8px;
          padding: 9px;
          background: transparent;
          border: 1px solid var(--danger);
          color: var(--danger);
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .btn-danger:hover { background: var(--danger); color: var(--text-on-ink); }
      `}</style>
    </aside>
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
        <button
          type="button"
          className={`toggle-btn ${el.bold ? "is-on" : ""}`}
          onClick={() => onUpdate(el.id, { bold: !el.bold })}
        >
          B
        </button>
        <button
          type="button"
          className={`toggle-btn ${el.italic ? "is-on" : ""}`}
          onClick={() => onUpdate(el.id, { italic: !el.italic })}
        >
          I
        </button>
      </div>
      <label className="field-label">Color</label>
      <input type="color" value={el.color} onChange={(e) => onUpdate(el.id, { color: e.target.value })} />
      <style>{`
        .style-toggles { display: flex; gap: 6px; }
        .toggle-btn {
          width: 32px; height: 30px;
          background: var(--ink-700);
          border: 1px solid var(--ink-700);
          color: var(--text-on-ink);
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-family: var(--font-ui);
          font-size: 13px;
        }
        .toggle-btn:nth-child(2) { font-style: italic; }
        .toggle-btn.is-on {
          background: var(--accent-amber);
          border-color: var(--accent-amber);
          color: var(--ink-900);
        }
      `}</style>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <style>{`
        .number-field { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--text-on-ink-dim); flex: 1; }
        .number-field input {
          background: var(--ink-700);
          border: 1px solid var(--ink-700);
          color: var(--text-on-ink);
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
