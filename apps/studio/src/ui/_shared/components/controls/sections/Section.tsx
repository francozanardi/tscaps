import { memo, useState, type ReactNode } from 'react';
import { Lock, ChevronDown } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

interface SectionProps {
  /** Optional. When omitted, the title row is not rendered — useful when the
   *  section is the only content of a tab and the tab already shows the title. */
  title?: string | undefined;
  children?: ReactNode;
  /** When provided, renders an expand button below the basic content that
   *  reveals this content with a height animation. */
  advanced?: ReactNode | undefined;
  /** Greys out + disables interaction across both basic and advanced content. */
  disabled?: boolean | undefined;
  /** Tooltip text shown on the "Locked" overlay badge when `disabled` is true. */
  disabledMessage?: string | undefined;
}

/**
 * Generic section wrapper used by every block in the style sidebar
 * (Typography, Colors, Position, Effects, Scenes, Lines, …). Owns the title,
 * the expand-advanced button + animated reveal, and the optional locked-state
 * overlay. Consumers pass their basic content as children and (optionally)
 * advanced content via the `advanced` prop.
 *
 * The advanced wrapper is a *sibling* of the basic content (not a flex
 * child of it) so its zero height when collapsed doesn't claim a `gap`
 * slot — that way a section with collapsed advanced content takes the
 * same vertical space as one with no advanced content at all.
 *
 * The advanced subtree always mounts (controlled atoms keep their state from
 * props anyway) and is hidden via a `grid-template-rows: 0fr → 1fr` trick;
 * this animates height-from-zero in pure CSS without JS measurement.
 */
export const Section = memo(function Section({
  title,
  children,
  advanced,
  disabled,
  disabledMessage,
}: SectionProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const hasAdvanced = advanced != null && advanced !== false;

  const dimmed = disabled
    ? 'opacity-40 pointer-events-none transition-opacity duration-base ease-standard'
    : 'transition-opacity duration-base ease-standard';

  return (
    <section className="py-[18px] flex flex-col gap-3 border-t border-edge-subtle first:border-t-0">
      {title !== undefined && (
        <header className="flex items-center justify-between min-h-5">
          <h3 className="font-mono text-2xs uppercase tracking-[0.08em] text-fg-muted m-0">
            {title}
          </h3>
        </header>
      )}

      <div className="group/section relative flex flex-col">
        {disabled && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-transparent rounded-xs cursor-not-allowed opacity-0 transition-opacity duration-base ease-standard group-hover/section:opacity-100">
            <Tooltip text={disabledMessage ?? 'Locked'} position="bottom">
              {/* No `pointer-events-none` — Radix Tooltip needs the trigger
                  to receive mouse events. Hovering the pill keeps the
                  section's `:hover` true (pill is a descendant), so the
                  group-hover fade stays active. */}
              <div className="flex items-center gap-1.5 bg-surface-1 px-3 py-1.5 rounded-pill text-xs text-fg-secondary border border-edge-strong shadow-sm translate-y-1 transition-transform duration-base ease-standard group-hover/section:translate-y-0">
                <Lock size={12} />
                <span>Locked</span>
              </div>
            </Tooltip>
          </div>
        )}

        <div className={`flex flex-col gap-2.5 ${dimmed}`}>
          {children}
          {hasAdvanced && (
            <button
              type="button"
              className="group w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-transparent border-none rounded-xs text-fg-faint font-mono text-2xs uppercase tracking-[0.08em] cursor-pointer mt-1 transition-colors duration-quick ease-standard hover:text-fg-secondary hover:bg-surface-2 aria-expanded:text-fg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-expanded={advancedOpen}
            >
              <span>{advancedOpen ? 'Show less' : 'Show more'}</span>
              <ChevronDown
                size={14}
                className="opacity-75 transition-[transform,opacity] duration-base ease-emphasized group-hover:opacity-100 group-aria-expanded:rotate-180 group-aria-expanded:opacity-100"
              />
            </button>
          )}
        </div>

        {hasAdvanced && (
          <div
            className={`grid overflow-hidden transition-[grid-template-rows,margin-top] duration-base ease-emphasized ${dimmed} ${
              advancedOpen ? 'grid-rows-[1fr] mt-2.5' : 'grid-rows-[0fr]'
            }`}
          >
            <div
              className={`min-h-0 flex flex-col gap-2.5 transition-[opacity,transform] duration-base ease-standard delay-[50ms] ${
                advancedOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
              }`}
            >
              {advanced}
            </div>
          </div>
        )}
      </div>
    </section>
  );
});
