import { X } from "lucide-react";

interface Props {
  version: string;
  onClose: () => void;
}

export function AboutModal({ version, onClose }: Props) {
  return (
    <div className="about-backdrop" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <div className="about-header">
          <h3>About PDFedits Studio</h3>
          <button className="about-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="about-line">
          <strong>Version</strong> {version}
        </p>
        <p className="about-line">Free, offline, desktop PDF editor. No account, no cloud, no ads.</p>
        <p className="about-line about-muted">
          Edit existing PDF text in place, add text/images/signatures, draw shapes, and export back to PDF, PNG, or JPG —
          all processed locally on your machine.
        </p>
        <div className="about-footer">PDFedits Studio · XpertsWP</div>
      </div>
      <style>{`
        .about-backdrop {
          position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35);
          display: flex; align-items: center; justify-content: center; z-index: 60;
        }
        .about-modal {
          background: var(--bg-panel); border-radius: var(--radius-md);
          padding: 20px 22px; width: 380px; box-shadow: 0 20px 50px rgba(15,23,42,0.25);
          border: 1px solid var(--border);
        }
        .about-header {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
        }
        .about-header h3 {
          font-size: 15px; font-weight: 700; margin: 0; color: var(--text-primary);
        }
        .about-close {
          all: unset; cursor: pointer; color: var(--text-tertiary); display: flex; padding: 4px; border-radius: 4px;
        }
        .about-close:hover { background: var(--bg-canvas); }
        .about-line {
          font-size: 13px; color: var(--text-primary); margin: 0 0 10px; line-height: 1.5;
        }
        .about-muted { color: var(--text-secondary); font-size: 12px; }
        .about-footer {
          margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border);
          font-size: 11px; color: var(--text-tertiary);
        }
      `}</style>
    </div>
  );
}
