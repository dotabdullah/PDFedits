import { useState } from "react";
import { Search, X } from "lucide-react";
import type { SearchMatch } from "../lib/types";

interface Props {
  onSearch: (query: string) => Promise<SearchMatch[]>;
  onJump: (match: SearchMatch) => void;
  onClose: () => void;
}

export function SearchPanel({ onSearch, onJump, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    const matches = await onSearch(query);
    setResults(matches);
    setSearched(true);
    setSearching(false);
  }

  return (
    <div className="search-panel">
      <form className="search-form" onSubmit={runSearch}>
        <Search size={14} className="search-icon" />
        <input
          autoFocus
          type="text"
          placeholder="Find in document…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="search-close" onClick={onClose}>
          <X size={14} />
        </button>
      </form>

      {searching && <div className="search-status">Searching…</div>}
      {!searching && searched && results.length === 0 && <div className="search-status">No matches</div>}

      {!searching && results.length > 0 && (
        <div className="search-results">
          {results.slice(0, 50).map((m, i) => (
            <button key={i} className="search-result" onClick={() => onJump(m)}>
              <span className="result-page">p.{m.page + 1}</span>
              <span className="result-snippet">{m.snippet}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .search-panel {
          position: absolute;
          top: calc(var(--header-height) + 4px);
          right: 60px;
          width: 320px;
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: 0 12px 32px rgba(15,23,42,0.16);
          z-index: 40;
          overflow: hidden;
        }
        .search-form {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
        }
        .search-icon { color: var(--text-tertiary); flex-shrink: 0; }
        .search-form input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 13px;
          font-family: var(--font-ui);
          color: var(--text-primary);
        }
        .search-close {
          all: unset; cursor: pointer; color: var(--text-tertiary); display: flex;
        }
        .search-status {
          padding: 12px; font-size: 12px; color: var(--text-tertiary); text-align: center;
        }
        .search-results {
          max-height: 320px;
          overflow-y: auto;
        }
        .search-result {
          all: unset;
          cursor: pointer;
          display: flex;
          gap: 8px;
          align-items: baseline;
          width: 100%;
          padding: 9px 12px;
          border-bottom: 1px solid var(--border);
          box-sizing: border-box;
        }
        .search-result:hover { background: var(--accent-blue-soft); }
        .result-page {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--accent-blue);
          flex-shrink: 0;
        }
        .result-snippet {
          font-size: 12px;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
