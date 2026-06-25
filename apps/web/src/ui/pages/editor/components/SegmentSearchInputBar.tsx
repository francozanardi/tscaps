import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { RefObject } from 'react';

const ICON_BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-xs bg-transparent border-none cursor-pointer ' +
  'text-fg-secondary hover:text-fg-primary hover:bg-surface-2 ' +
  'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:bg-surface-2 ' +
  'disabled:text-fg-faint disabled:hover:bg-transparent disabled:cursor-not-allowed';

const SEARCH_INPUT =
  'flex-1 min-w-0 bg-surface-2 border border-edge-subtle rounded-xs px-2 py-1 text-xs text-fg-primary ' +
  'placeholder:text-fg-faint outline-none focus:border-edge-medium transition-colors duration-quick ease-standard';

const CONTAINER_CLASS = 'flex items-center gap-1 px-1 py-1.5 border-t border-edge-subtle';

interface SegmentSearchInputBarProps {
  inputRef: RefObject<HTMLInputElement>;
  query: string;
  matchCount: number;
  currentMatchOrdinal: number;
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

/**
 * Search input row with a hit counter and prev/next/close
 * affordances. Enter advances to the next match, Shift+Enter goes
 * back, Escape closes the bar.
 */
export function SegmentSearchInputBar({
  inputRef,
  query,
  matchCount,
  currentMatchOrdinal,
  onQueryChange,
  onNext,
  onPrev,
  onClose,
}: SegmentSearchInputBarProps) {
  const hasMatches = matchCount > 0;
  return (
    <div className={CONTAINER_CLASS}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) onPrev(); else onNext();
          }
        }}
        placeholder="Find in scenes…"
        spellCheck={false}
        className={SEARCH_INPUT}
      />
      <span className="text-2xs text-fg-faint tabular-nums font-mono px-1 shrink-0">
        {hasMatches ? `${currentMatchOrdinal}/${matchCount}` : '0/0'}
      </span>
      <button
        type="button"
        className={ICON_BTN}
        onClick={onPrev}
        disabled={!hasMatches}
        aria-label="Previous match"
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        className={ICON_BTN}
        onClick={onNext}
        disabled={!hasMatches}
        aria-label="Next match"
      >
        <ChevronDown size={14} />
      </button>
      <button
        type="button"
        className={ICON_BTN}
        onClick={onClose}
        aria-label="Close search"
      >
        <X size={14} />
      </button>
    </div>
  );
}
