import { Plus, X, FileText } from "lucide-react";

export interface TabSummary {
  id: string;
  fileName: string;
  hasEdits: boolean;
}

interface Props {
  tabs: TabSummary[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

export function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onNewTab }: Props) {
  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map((tab) => (
          <div key={tab.id} className={`tab-pill ${tab.id === activeTabId ? "is-active" : ""}`} onClick={() => onSelectTab(tab.id)}>
            <FileText size={12} className="tab-icon" />
            <span className="tab-name">
              {tab.fileName}
              {tab.hasEdits && <span className="tab-dot" title="Unsaved edits" />}
            </span>
            <button
              className="tab-close"
              title="Close tab"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button className="tab-add" onClick={onNewTab} title="Open another PDF in a new tab">
        <Plus size={14} />
      </button>

      <style>{`
        .tab-bar {
          grid-area: tabbar;
          background: var(--bg-panel);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0 8px;
          overflow-x: auto;
        }
        .tab-list {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 100%;
        }
        .tab-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 8px 0 10px;
          height: 26px;
          border-radius: 6px 6px 0 0;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          flex-shrink: 0;
          max-width: 180px;
        }
        .tab-pill:hover:not(.is-active) {
          background: var(--bg-canvas);
        }
        .tab-pill.is-active {
          background: var(--accent-blue-soft);
          color: var(--accent-blue-strong);
        }
        .tab-icon { flex-shrink: 0; opacity: 0.7; }
        .tab-name {
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .tab-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent-blue);
          flex-shrink: 0;
        }
        .tab-close {
          all: unset;
          cursor: pointer;
          display: flex;
          padding: 2px;
          border-radius: 3px;
          color: inherit;
          opacity: 0.6;
          flex-shrink: 0;
        }
        .tab-close:hover {
          opacity: 1;
          background: rgba(0,0,0,0.08);
        }
        .tab-add {
          all: unset;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 5px;
          color: var(--text-tertiary);
          flex-shrink: 0;
        }
        .tab-add:hover {
          background: var(--bg-canvas);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
