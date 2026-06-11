import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface AutocompleteOption {
  readonly value: string;
  readonly label: string;
}

/**
 * One section in a grouped picker. The picker shows a small header with
 * `label` at the top of the section followed by the section's options.
 *
 * `renderOptionAction` lets the section attach a per-option button (e.g.
 * a delete icon for user-uploaded fonts). It renders inside the option's
 * row, right-aligned, and is responsible for stopping propagation if it
 * shouldn't trigger selection.
 */
export interface AutocompleteGroup<T extends AutocompleteOption> {
  readonly id: string;
  readonly label: string;
  readonly options: readonly T[];
  readonly renderOptionAction?: (option: T) => ReactNode;
}

interface AutocompletePropsBase<T extends AutocompleteOption> {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean | undefined;
  renderOption?: (option: T) => ReactNode;
  /**
   * Optional CTA region rendered ABOVE the scrollable rows in the dropdown.
   * Stays visible regardless of scroll/filter — meant for entry points like
   * "Upload custom font" that should always be reachable. The region's
   * height is the consumer's responsibility (typically a single 32px row to
   * match option height).
   */
  header?: ReactNode;
}

type AutocompleteProps<T extends AutocompleteOption> = AutocompletePropsBase<T> & (
  | { options: readonly T[]; groups?: undefined }
  | { groups: ReadonlyArray<AutocompleteGroup<T>>; options?: undefined }
);

const ITEM_BASE =
  'pr-2.5 py-1.5 text-sm text-fg-secondary cursor-pointer truncate relative flex items-center gap-2 group/option ' +
  'transition-colors duration-quick ease-standard';

const ITEM_CURRENT_INDICATOR =
  "before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-accent before:rounded-r-[2px]";

const HEADER_BASE =
  'px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.08em] text-fg-faint flex items-center select-none border-b border-edge-subtle bg-surface-3/40';

// Fixed-height rows + windowing keep the DOM (and therefore the per-option
// `renderOption` work, which sets `fontFamily` and triggers font fetches)
// to whatever fits in the viewport plus a small overscan, instead of
// rendering every option whenever the dropdown opens.
const ROW_HEIGHT_PX = 32;
const VIEWPORT_HEIGHT_PX = 240;
const OVERSCAN = 3;

function itemClass(active: boolean, current: boolean, indented: boolean): string {
  const parts = [ITEM_BASE, indented ? 'pl-5' : 'pl-2.5'];
  if (active) parts.push('bg-surface-3');
  if (current) parts.push(ITEM_CURRENT_INDICATOR);
  return parts.join(' ');
}

type Row<T extends AutocompleteOption> =
  | { readonly kind: 'header'; readonly group: AutocompleteGroup<T> }
  | { readonly kind: 'option'; readonly option: T; readonly group: AutocompleteGroup<T>; readonly indented: boolean };

interface OptionLocation<T extends AutocompleteOption> {
  readonly rowIdx: number;
  readonly option: T;
  readonly group: AutocompleteGroup<T>;
}

// Searchable picker. Stored value must always match an option.value — the
// input shows the selected option's label while idle and the user's query
// while editing. Commit happens on click or Enter.
//
// Accepts either a flat `options` list or grouped `groups`. Filtering and
// virtualization work the same in both modes; the grouped variant adds
// per-section headers and indents the options below them so the section
// hierarchy reads visually. An optional `header` prop hosts a sticky CTA
// (e.g. "Upload custom font") that lives above the scroll area.
export const Autocomplete = memo(function Autocomplete<T extends AutocompleteOption>({
  value,
  onChange,
  disabled,
  renderOption,
  options,
  groups,
  header,
}: AutocompleteProps<T>) {
  const effectiveGroups = useMemo<ReadonlyArray<AutocompleteGroup<T>>>(
    () => groups ?? [{ id: '__default__', label: '', options: options ?? [] }],
    [groups, options],
  );

  const selected = useMemo(() => {
    for (const g of effectiveGroups) {
      for (const o of g.options) if (o.value === value) return o;
    }
    return undefined;
  }, [effectiveGroups, value]);
  const display = selected?.label ?? String(value);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Build the flat row list and a parallel option-only index for keyboard
  // navigation. Header rows aren't selectable so `activeIndex` skips over
  // them; we track each option's `rowIdx` to scroll-into-view correctly.
  // Options inherit an `indented` flag so they read as nested under their
  // section header instead of looking like siblings of it.
  const { rows, optionLocations } = useMemo(() => {
    const rows: Row<T>[] = [];
    const optionLocations: OptionLocation<T>[] = [];
    const q = query.trim().toLowerCase();
    for (const group of effectiveGroups) {
      const filtered = q.length === 0
        ? group.options
        : group.options.filter((o) => o.label.toLowerCase().includes(q));
      if (filtered.length === 0) continue;
      const hasHeader = group.label !== '';
      if (hasHeader) rows.push({ kind: 'header', group });
      for (const option of filtered) {
        optionLocations.push({ rowIdx: rows.length, option, group });
        rows.push({ kind: 'option', option, group, indented: hasHeader });
      }
    }
    return { rows, optionLocations };
  }, [effectiveGroups, query]);

  const visibleCount = Math.ceil(VIEWPORT_HEIGHT_PX / ROW_HEIGHT_PX);
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN);
  const endIdx = Math.min(rows.length, startIdx + visibleCount + 2 * OVERSCAN);
  const topPad = startIdx * ROW_HEIGHT_PX;
  const bottomPad = Math.max(0, (rows.length - endIdx) * ROW_HEIGHT_PX);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Reset scroll when the filter changes — yesterday's scrollTop has no
  // meaning against today's filtered rows, and would otherwise leave the
  // active row off-screen. The setState mirrors the DOM scrollTop reset
  // so virtual-list math reads the same value.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [query]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Keep the keyboard-active row in view. `useLayoutEffect` because we
  // need to compute scroll before paint, otherwise arrow-key navigation
  // can flicker the active row out of the viewport.
  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const list = listRef.current;
    const loc = optionLocations[activeIndex];
    if (!loc) return;
    const itemTop = loc.rowIdx * ROW_HEIGHT_PX;
    const itemBottom = itemTop + ROW_HEIGHT_PX;
    if (itemTop < list.scrollTop) {
      list.scrollTop = itemTop;
    } else if (itemBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = itemBottom - list.clientHeight;
    }
  }, [activeIndex, open, optionLocations]);

  const findActiveIndexFor = (v: string): number => {
    const idx = optionLocations.findIndex((loc) => loc.option.value === v);
    return Math.max(0, idx);
  };

  const commit = (option: T) => {
    onChange(option.value);
    setOpen(false);
    setQuery('');
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, optionLocations.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const loc = optionLocations[activeIndex];
      if (loc) commit(loc.option);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  const visibleRows = rows.slice(startIdx, endIdx);
  const hasContent = header !== undefined || rows.length > 0;

  return (
    <div className="flex-1 relative" ref={rootRef}>
      <input
        type="text"
        className="w-full h-[26px] px-2 text-xs text-fg-secondary bg-surface-2 border border-edge-medium rounded-xs transition-colors duration-quick ease-standard hover:border-edge-strong focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-40 disabled:cursor-not-allowed"
        value={open ? query : display}
        placeholder={display}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setActiveIndex(findActiveIndexFor(value));
        }}
        onClick={() => {
          // Reopen after a commit (which closes while keeping focus): a second
          // click on an already-focused input fires no `focus` event, so we
          // need a click handler too. Idempotent when already open.
          if (!open) {
            setOpen(true);
            setQuery('');
            setActiveIndex(findActiveIndexFor(value));
          }
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={handleKey}
      />
      {open && hasContent && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-surface-2 border border-edge-subtle rounded-xs z-20 shadow-md overflow-hidden animate-fade-in">
          {header !== undefined && (
            <div className="border-b border-edge-subtle">{header}</div>
          )}
          {rows.length > 0 && (
            <ul
              ref={listRef}
              role="listbox"
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
              className="max-h-[240px] overflow-y-auto list-none py-0 m-0"
            >
              {topPad > 0 && <li aria-hidden style={{ height: topPad }} />}
              {visibleRows.map((row, vIdx) => {
                const idx = startIdx + vIdx;
                if (row.kind === 'header') {
                  return (
                    <li
                      key={`h:${row.group.id}`}
                      role="presentation"
                      style={{ height: ROW_HEIGHT_PX }}
                      className={HEADER_BASE}
                    >
                      <span className="truncate">{row.group.label}</span>
                    </li>
                  );
                }
                const optionIdx = optionLocations.findIndex((loc) => loc.rowIdx === idx);
                const isActive = optionIdx === activeIndex;
                const isCurrent = row.option.value === value;
                const action = row.group.renderOptionAction?.(row.option);
                return (
                  <li
                    key={`${row.group.id}:${row.option.value}`}
                    role="option"
                    aria-selected={isActive}
                    style={{ height: ROW_HEIGHT_PX }}
                    className={itemClass(isActive, isCurrent, row.indented)}
                    onMouseEnter={() => { if (optionIdx >= 0) setActiveIndex(optionIdx); }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(row.option);
                    }}
                  >
                    <span className="flex-1 min-w-0 truncate">
                      {renderOption ? renderOption(row.option) : row.option.label}
                    </span>
                    {action !== undefined && (
                      <span className="shrink-0 [@media(hover:hover)]:opacity-0 group-hover/option:opacity-100 transition-opacity">
                        {action}
                      </span>
                    )}
                  </li>
                );
              })}
              {bottomPad > 0 && <li aria-hidden style={{ height: bottomPad }} />}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}) as <T extends AutocompleteOption>(props: AutocompleteProps<T>) => ReactNode;
