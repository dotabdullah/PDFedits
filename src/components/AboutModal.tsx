import { X, ExternalLink, Phone, Mail } from "lucide-react";

interface Props {
  version: string;
  onClose: () => void;
}

const COMPANY_NAME = "XpertsWP";
const COMPANY_URL = "https://xpertswp.com/";
const SUPPORT_EMAIL = "support@xpertswp.com";
const WHATSAPP_NUMBER = "923111765486"; // +92 311 1765486, wa.me format (no +, no spaces)
const WHATSAPP_MESSAGE = "I need help about PDFedits application..";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
const LOGO_PATH = "/branding/xpertswp-logo.webp";

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

        <div className="about-developer">
          <div className="developer-brand">
            <img src={LOGO_PATH} alt={COMPANY_NAME} className="developer-logo" />
            <div>
              <div className="developer-label">Developed by</div>
              <a href={COMPANY_URL} target="_blank" rel="noreferrer" className="developer-name">
                {COMPANY_NAME} <ExternalLink size={12} />
              </a>
            </div>
          </div>

          <div className="developer-contacts">
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="contact-row">
              <Phone size={13} /> +92 311 1765486
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="contact-row">
              <Mail size={13} /> {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        <div className="about-footer">PDFedits Studio · {COMPANY_NAME}</div>
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
        .about-developer {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
        }
        .developer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .developer-logo {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          object-fit: contain;
          background: var(--bg-canvas);
          border: 1px solid var(--border);
          flex-shrink: 0;
        }
        .developer-label {
          font-size: 10.5px;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 2px;
        }
        .developer-name {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13.5px;
          font-weight: 700;
          color: var(--accent-blue);
          text-decoration: none;
        }
        .developer-name:hover { text-decoration: underline; }
        .developer-contacts {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .contact-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          color: var(--text-secondary);
          text-decoration: none;
        }
        .contact-row:hover { color: var(--accent-blue); }
        .about-footer {
          margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border);
          font-size: 11px; color: var(--text-tertiary);
        }
      `}</style>
    </div>
  );
}
