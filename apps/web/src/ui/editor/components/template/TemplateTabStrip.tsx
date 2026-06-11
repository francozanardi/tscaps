import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TemplateTab {
  id: string;
  label: string;
}

interface TemplateTabStripProps {
  tabs: readonly TemplateTab[];
  activeId: string;
  onSelect: (id: string) => void;
}

const ACTIVE_TAB_CLASS =
  'shrink-0 px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.08em] rounded-xs cursor-pointer border bg-surface-3 text-fg-primary border-edge-medium transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30';
const INACTIVE_TAB_CLASS =
  'shrink-0 px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.08em] rounded-xs cursor-pointer border bg-transparent text-fg-faint border-transparent transition-colors duration-quick ease-standard hover:text-fg-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:text-fg-secondary focus-visible:bg-surface-2';
const SCROLL_BUTTON_CLASS =
  'shrink-0 p-0.5 rounded-xs text-fg-faint cursor-pointer transition-colors duration-quick ease-standard hover:text-fg-secondary focus-visible:outline-none focus-visible:text-fg-secondary disabled:opacity-40 disabled:cursor-default disabled:hover:text-fg-faint';

/**
 * Horizontal pill-tab strip with scroll overflow affordances. The
 * arrow buttons only appear once the strip cannot fit all tabs in its
 * available width, and disable individually when the corresponding
 * edge is already reached. Renders nothing when only a single tab is
 * provided — the caller decides whether the strip is even relevant.
 */
export const TemplateTabStrip = memo(function TemplateTabStrip({
  tabs,
  activeId,
  onSelect,
}: TemplateTabStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const update = () => {
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [tabs]);

  const scrollBy = useCallback((direction: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: 'smooth' });
  }, []);

  if (tabs.length <= 1) return null;
  const showScrollControls = canScrollLeft || canScrollRight;

  return (
    <div className="flex items-center gap-1">
      {showScrollControls && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          disabled={!canScrollLeft}
          aria-label="Scroll tabs left"
          className={SCROLL_BUTTON_CLASS}
        >
          <ChevronLeft size={14} />
        </button>
      )}
      <div
        ref={stripRef}
        className="flex-1 min-w-0 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              aria-pressed={isActive}
              className={isActive ? ACTIVE_TAB_CLASS : INACTIVE_TAB_CLASS}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {showScrollControls && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          disabled={!canScrollRight}
          aria-label="Scroll tabs right"
          className={SCROLL_BUTTON_CLASS}
        >
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
});
