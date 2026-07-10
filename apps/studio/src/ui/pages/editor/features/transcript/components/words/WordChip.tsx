import { memo } from 'react';

const WORD_BASE =
  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs cursor-pointer select-none whitespace-nowrap border ' +
  'transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none focus-visible:border-accent';
const WORD_INACTIVE = `${WORD_BASE} bg-surface-2 border-edge-medium text-fg-secondary hover:bg-surface-3 hover:border-edge-strong hover:text-fg-primary`;
const WORD_ACTIVE = `${WORD_BASE} bg-accent/20 border-accent/70 text-info`;
// Solid accent fill, no halo — the accent token is theme-aware so the dot
// reads on both light and dark surfaces. Single, subtle marker; lets the
// chip background stay neutral.
const OVERRIDE_DOT = 'inline-block w-1.5 h-1.5 rounded-full bg-accent shrink-0';

interface WordChipProps {
  wordId: string;
  text: string;
  isActive: boolean;
  hasOverride: boolean;
  onActivate: (wordId: string, currentlyActive: boolean) => void;
}

/**
 * Word pill in the transcript subtab. Memoized with primitive-only props so a
 * per-word override change (e.g. dragging the color picker for one word)
 * doesn't re-render the chips for every other word in the document. Without
 * this, the subtab walks the entire word tree on each color tick and the
 * drag pegs the CPU.
 */
export const WordChip = memo(function WordChip({ wordId, text, isActive, hasOverride, onActivate }: WordChipProps) {
  return (
    <span
      className={isActive ? WORD_ACTIVE : WORD_INACTIVE}
      onClick={(e) => { e.stopPropagation(); onActivate(wordId, isActive); }}
    >
      <span>{text || <span className="text-fg-faint italic">·</span>}</span>
      {hasOverride && <span className={OVERRIDE_DOT} aria-label="Has style overrides" />}
    </span>
  );
});
