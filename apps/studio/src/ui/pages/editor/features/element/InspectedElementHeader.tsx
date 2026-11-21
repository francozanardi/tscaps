import type { ReactNode } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import type { InspectedElement } from '@ui/pages/editor/features/element/useInspectedElement';
import type { InspectedElementPlay } from '@ui/pages/editor/features/element/useInspectedElementPlay';

interface InspectedElementHeaderProps {
  element: InspectedElement;
  /**
   * A small picture of the element, drawn first: a shot's frame, a
   * layer's file, an emoji's glyph, a word's or a scene's icon. It is
   * what tells where the user stands before the name is read.
   */
  thumbnail: ReactNode;
  /** What can be done to the element as a whole, drawn after its name. */
  actions?: ReactNode;
  /**
   * Puts the element back to its defaults — its template's, its preset's,
   * or a fresh layer's — fields, motion, CSS and sounds alike. `enabled`
   * says whether it holds anything to take back. Null where there is no
   * one set of defaults, as for several layers edited together.
   */
  reset: { readonly enabled: boolean; readonly onReset: () => void } | null;
  /** Plays the element from its start, offered before its actions; null for an element with no one stretch. */
  play: InspectedElementPlay | null;
  /** Whether the playhead is off the element, said at the end of the line under its name. */
  offScreen: boolean;
}

const KIND_LABEL_CLASS =
  'shrink-0 text-fg-muted font-mono text-3xs uppercase tracking-[0.06em]';

const OFF_SCREEN_CLASS =
  'text-warning cursor-help underline decoration-dotted decoration-warning/50 underline-offset-2';

const PLAY_BUTTON_CLASS =
  'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-xs bg-transparent border-none '
  + 'text-fg-secondary cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-fg-primary hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2';

const CLEAR_BUTTON_CLASS =
  'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-xs bg-transparent border-none '
  + 'text-fg-faint cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-fg-secondary focus-visible:outline-none focus-visible:text-fg-secondary '
  + 'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-fg-faint';

/**
 * Says which element the panel is editing, and offers the one action
 * that applies to the whole element rather than to a single property.
 *
 * Shows the element, then names it (an emoji, whose picture is its
 * name, is not named twice), never the panel: the panel follows
 * what is picked in the preview, so the pick is the only title it could
 * carry. Its kind leads the line under the name, so the name keeps the
 * width. While the element is not on screen it says so in place, at the
 * end of that same line, so nothing below moves.
 */
export function InspectedElementHeader({ element, thumbnail, actions, reset, play, offScreen }: InspectedElementHeaderProps) {
  // An emoji's name is its glyph, which its picture already shows. Naming the word it hangs
  // on would be no better: it reads as belonging to the scene.
  const showsName = element.kind !== 'decoration';
  return (
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      {thumbnail}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {/* `truncate` clips whatever sticks out of the line box, so the
            line box has to hold the font's descenders: `leading-none`
            cut the tail off every g and y. */}
        {showsName && (
          <span className="text-sm text-fg-primary font-medium truncate leading-snug">{element.name}</span>
        )}
        <span className="flex items-baseline gap-1.5 min-w-0 text-2xs text-fg-faint leading-snug">
          <span className={KIND_LABEL_CLASS}>{element.kindLabel}</span>
          {element.context && <span className="truncate tabular-nums">{element.context}</span>}
          {/* In the state colour, and never truncated away: an edit made here shows nowhere
              until the playhead is back, which is easy to miss in the faint line's grey. */}
          {offScreen && (
            <>
              <span className="shrink-0" aria-hidden>·</span>
              {/* The tap tooltip wraps its trigger in a span of its own, which would shrink. */}
              <span className="shrink-0 flex">
                <Tooltip text={offScreenHint(element.kindLabel)} tapToOpen>
                  <span className={OFF_SCREEN_CLASS}>Not on screen</span>
                </Tooltip>
              </span>
            </>
          )}
        </span>
      </div>
      {play && (
        <Tooltip text={play.label}>
          <button type="button" onClick={play.play} aria-label={play.label} className={PLAY_BUTTON_CLASS}>
            <Play size={15} strokeWidth={2} />
          </button>
        </Tooltip>
      )}
      {actions}
      {reset && (
        <Tooltip text="Reset this element">
          <button
            type="button"
            onClick={reset.onReset}
            disabled={!reset.enabled}
            aria-label="Reset this element"
            className={CLEAR_BUTTON_CLASS}
          >
            <RotateCcw size={15} strokeWidth={2} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

/** What *Not on screen* means for an element of the kind called `kindLabel`, and the way back to it. */
function offScreenHint(kindLabel: string): string {
  const kind = kindLabel.toLowerCase();
  return `The playhead is outside this ${kind}, so the preview isn't showing it. Press Play to watch the ${kind}.`;
}
