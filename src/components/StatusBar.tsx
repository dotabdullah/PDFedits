interface Props {
  onAboutClick: () => void;
}

export function StatusBar({ onAboutClick }: Props) {
  return (
    <footer className="status-bar">
      <span className="status-left">PDFedits Studio — Free · Offline PDF Editor</span>
      <button className="status-right" onClick={onAboutClick}>
        About
      </button>
      <style>{`
        .status-bar {
          grid-area: status;
          background: var(--bg-panel);
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
        }
        .status-left {
          font-size: 11px;
          color: var(--text-tertiary);
        }
        .status-right {
          all: unset;
          cursor: pointer;
          font-size: 11px;
          color: var(--accent-blue);
        }
        .status-right:hover {
          text-decoration: underline;
        }
      `}</style>
    </footer>
  );
}
