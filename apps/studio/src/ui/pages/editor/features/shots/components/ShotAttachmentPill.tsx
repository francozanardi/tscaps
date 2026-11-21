import type { MouseEvent } from 'react';
import { Check, CornerDownRight, type LucideIcon } from 'lucide-react';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

/** How a pill reads: all well, a step under way, or needing the reader. */
export type ShotAttachmentTone = 'ready' | 'busy' | 'alert';

interface ShotAttachmentPillProps {
  /** What the shot holds, as the pill names it. */
  label: string;
  icon: LucideIcon;
  tone: ShotAttachmentTone;
  /** How far the step under way has gone, 0 to 1, or null for none. */
  progress: number | null;
  /** What the pill says on hover and to a screen reader beside its label, or null for nothing more. */
  note: string | null;
  /** While the panel is picking layers: whether this one is picked. Absent otherwise. */
  picked?: boolean | undefined;
  /** Whether the shot only goes on showing it: an earlier shot holds it. */
  continues?: boolean | undefined;
  onOpen: (event: MouseEvent) => void;
}

// Filled with the hairline tint rather than a colour of its own: the
// pill carries no hue, only red when it needs the reader.
const CHIP_CLASS =
  'relative overflow-hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs border-none cursor-pointer '
  + 'text-3xs font-medium leading-none '
  + 'transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
const TONE_CLASS = {
  ready: 'text-fg-secondary hover:text-fg-primary',
  busy: 'text-fg-muted hover:text-fg-secondary',
  alert: 'text-danger',
} as const;
const ICON_CLASS = {
  ready: 'text-fg-muted',
  busy: 'text-fg-muted',
  alert: 'text-danger',
} as const;
const AT_REST_CLASS = 'bg-edge-faint hover:bg-edge-subtle';
// Held by an earlier shot and still showing: the same pill a tone quieter, led by a mark that it comes from above.
const CONTINUES_CLASS = 'text-fg-muted hover:text-fg-secondary';
// Picked while the panel picks layers: the one place a pill takes the accent.
const PICKED_CLASS = 'bg-accent/20 text-fg-primary ring-1 ring-inset ring-accent';
// How far the step under way has gone, filling the pill from the left.
const FILL_CLASS = 'absolute inset-y-0 left-0 bg-edge-subtle transition-[width] duration-base ease-standard';

/**
 * Something a shot holds, as a filled pill under its card: sentence
 * case, no hue of its own, red only in its text and icon when it needs
 * the reader, filling from the left while a step goes. Pressing it, or
 * right-clicking it, opens what it names.
 *
 * Something an earlier shot holds and this one still shows is the same
 * pill, a tone quieter and led by a mark that it continues from above.
 */
export function ShotAttachmentPill({ label, icon, tone, progress, note, picked, continues, onOpen }: ShotAttachmentPillProps) {
  const Icon = picked ? Check : icon;
  const atRest = continues && tone === 'ready' ? CONTINUES_CLASS : TONE_CLASS[tone];
  const button = (
    <button
      type="button"
      className={`${CHIP_CLASS} ${picked ? PICKED_CLASS : `${AT_REST_CLASS} ${atRest}`}`}
      data-continues={continues || undefined}
      aria-pressed={picked}
      aria-label={note === null ? label : `${label}. ${note}`}
      onClick={onOpen}
      onContextMenu={onOpen}
    >
      {progress !== null && <span className={FILL_CLASS} style={{ width: `${progress * 100}%` }} aria-hidden />}
      <span className="relative inline-flex items-center gap-1">
        {continues && <CornerDownRight size={10} className="text-fg-faint" aria-hidden />}
        <Icon size={11} className={picked ? 'text-accent' : ICON_CLASS[tone]} aria-hidden />
        {label}
        {progress !== null && <span className="font-mono tabular-nums">{Math.round(progress * 100)}%</span>}
      </span>
    </button>
  );
  return note === null ? button : <Tooltip text={note}>{button}</Tooltip>;
}
