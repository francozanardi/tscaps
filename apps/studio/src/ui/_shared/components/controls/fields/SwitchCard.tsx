import { memo, useId, type ReactNode } from 'react';
import * as Switch from '@radix-ui/react-switch';
import { Loader2 } from 'lucide-react';

interface SwitchCardProps {
  title: string;
  /** What the switch does, or why it cannot be changed while `locked`. */
  legend: string;
  /**
   * What the switch does, drawn. It fills a 56×40 frame and is drawn in
   * `currentColor` where it wants the card's tone: muted at rest, accent
   * when on.
   */
  picture: ReactNode;
  checked: boolean;
  /** Cannot be changed here. Dims the picture and the switch; the legend carries the reason. */
  locked?: boolean | undefined;
  /** Working on the last change. Blocks a second one and shows progress in place of the switch, without dimming. */
  busy?: boolean | undefined;
  /**
   * Omit to draw the card without making it a control, for a wrapper that
   * is the control itself — a gate, which cannot hold a second button.
   */
  onCheckedChange?: ((checked: boolean) => void) | undefined;
}

const CARD_CLASS =
  'group w-full flex items-center gap-3 p-2 rounded-sm border bg-surface-2 text-left '
  + 'transition-colors duration-quick ease-standard outline-none '
  + 'border-edge-subtle text-fg-muted '
  + 'data-[state=checked]:border-accent data-[state=checked]:bg-accent/10 data-[state=checked]:text-accent';
const INTERACTIVE_CLASS =
  'cursor-pointer enabled:hover:border-edge-medium focus-visible:ring-2 focus-visible:ring-accent/40 '
  + 'disabled:cursor-not-allowed';
const DIMMED_CLASS = 'opacity-40';

const PICTURE_CLASS =
  'shrink-0 flex w-14 h-10 rounded-xs overflow-hidden border border-edge-subtle bg-surface-3';
const TEXT_CLASS = 'flex-1 min-w-0 flex flex-col gap-1';
const TITLE_CLASS = 'text-xs text-fg-secondary group-data-[state=checked]:text-fg-primary';
const LEGEND_CLASS = 'text-2xs text-fg-faint leading-snug';

const TRACK_CLASS =
  'relative inline-flex shrink-0 w-8 h-[18px] rounded-pill bg-surface-3 border border-edge-medium '
  + 'transition-colors duration-quick ease-standard '
  + 'group-data-[state=checked]:bg-accent/25 group-data-[state=checked]:border-accent';
const THUMB_CLASS =
  'block w-3.5 h-3.5 rounded-full bg-fg-muted translate-x-px '
  + 'transition-[transform,background-color] duration-quick ease-standard will-change-transform '
  + 'group-data-[state=checked]:translate-x-[15px] group-data-[state=checked]:bg-accent';
const BUSY_CLASS = 'shrink-0 flex items-center justify-center w-8 h-[18px] text-fg-muted';

/**
 * A boolean drawn as a card: a picture of what it does, a title, a
 * legend, and its switch. For a setting whose effect is easier seen
 * than read; a plain `Toggle` stays the answer for the rest.
 *
 * The whole card is the switch, so the target is the row the user reads
 * rather than the 32px track at its end. The picture shows the effect
 * whether or not it is on — it says what the switch would do.
 */
export const SwitchCard = memo(function SwitchCard({
  title,
  legend,
  picture,
  checked,
  locked = false,
  busy = false,
  onCheckedChange,
}: SwitchCardProps) {
  const titleId = useId();
  const legendId = useId();
  // Only the picture and the switch dim when locked: the legend is the
  // reason, and dimmed it would be the one thing on the card left unread.
  const dimmed = locked ? DIMMED_CLASS : '';

  const body = (
    <>
      <span className={`${PICTURE_CLASS} ${dimmed}`} aria-hidden>{picture}</span>
      <span className={TEXT_CLASS}>
        <span id={titleId} className={TITLE_CLASS}>{title}</span>
        <span id={legendId} className={LEGEND_CLASS}>{legend}</span>
      </span>
      {busy ? (
        <span className={BUSY_CLASS}>
          <Loader2 size={14} className="animate-spin" />
        </span>
      ) : (
        <span className={`${TRACK_CLASS} ${dimmed}`}>
          {onCheckedChange === undefined ? <span className={THUMB_CLASS} /> : <Switch.Thumb className={THUMB_CLASS} />}
        </span>
      )}
    </>
  );

  if (onCheckedChange === undefined) {
    return (
      <span className={CARD_CLASS} data-state={checked ? 'checked' : 'unchecked'}>
        {body}
      </span>
    );
  }

  return (
    <Switch.Root
      aria-labelledby={titleId}
      aria-describedby={legendId}
      aria-busy={busy}
      checked={checked}
      disabled={locked || busy}
      onCheckedChange={onCheckedChange}
      className={`${CARD_CLASS} ${INTERACTIVE_CLASS}`}
    >
      {body}
    </Switch.Root>
  );
});
