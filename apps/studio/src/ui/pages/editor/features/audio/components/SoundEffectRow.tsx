import { memo } from 'react';
import { ArrowUpRight, AudioLines, ChevronLeft, ChevronRight, MoreHorizontal, Play, Square } from 'lucide-react';
import type { AudioEffectRow, AudioTabPresenter } from '@presentation/audio-mix/services/AudioTabPresenter';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { FIGURE_CLASS, ROW_ICON_BUTTON_CLASS } from '@ui/pages/editor/features/audio/audio-classes';
import { soundSpotlightKey } from '@ui/pages/editor/features/audio/soundSpotlightKey';
import { useSpotlightTarget } from '@ui/pages/editor/features/element/useSpotlightTarget';
import { AudioClipMenu } from '@ui/pages/editor/features/audio/components/AudioClipMenu';

interface SoundEffectRowProps {
  row: AudioEffectRow;
  presenter: AudioTabPresenter;
  projectId: string | null;
  /** Whether its sound is being heard on its own. */
  isPlaying: boolean;
  /** Plays its sound on its own, as it is placed, or stops it. */
  onAudition: (row: AudioEffectRow) => void;
  /** Plays the video around it, or stops that playback. */
  onPlayInVideo: (row: AudioEffectRow) => void;
  /** Moves the effect to play at the playhead. */
  onMoveToPlayhead: (clipId: string) => void;
  /** Leaves out what it is on, for a list where that goes without saying. Off by default. */
  hidesAnchor?: boolean | undefined;
  /** Takes the user to what plays it, there to change it; none by default. */
  goTo?: SoundEffectGoTo | null | undefined;
}

/** Where a sound comes from, as a button that goes there. */
export interface SoundEffectGoTo {
  /** What the button says it does, as its tooltip: `Open the camera`. */
  readonly label: string;
  readonly onGo: () => void;
}

const ROW_CLASS = 'flex flex-col gap-1 py-2 border-t border-edge-faint first:border-t-0';
const SEEK_CLASS =
  'flex flex-col flex-1 min-w-0 items-start gap-0 px-1 py-0 rounded-xs bg-transparent border-none text-left cursor-pointer '
  + 'transition-colors duration-quick ease-standard hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2 '
  + 'disabled:cursor-default disabled:hover:bg-transparent';
const PILL_TONE = { 'in-cut': 'subtle', hidden: 'subtle', detached: 'warning' } as const;

/**
 * One sound effect: a button that plays its sound, its name and what it
 * is on (pressed, the video plays around it), whether it is heard, its
 * menu, its level, and a nudge that plays it a little earlier or later. One that makes no sound is dimmed under a pill
 * saying why. An effect never loops, so it offers no loop. Where it is
 * listed apart from what it is on, a button can take the user there.
 */
export const SoundEffectRow = memo(function SoundEffectRow({
  row, presenter, projectId, isPlaying, onAudition, onPlayInVideo, onMoveToPlayhead, hidesAnchor = false, goTo = null,
}: SoundEffectRowProps) {
  const { actions } = useAudioMix();
  const { clip, seekSourceSec } = row;
  const dimmed = row.state !== 'heard';
  const nudge = (steps: number) => actions.patchClips.execute([clip.id], { startOffsetSec: presenter.nudged(clip.start, steps) });
  const spotlight = useSpotlightTarget<HTMLLIElement>(soundSpotlightKey(clip.id));
  return (
    <li ref={spotlight} className={ROW_CLASS}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={ROW_ICON_BUTTON_CLASS}
          aria-label={isPlaying ? `Stop ${row.name}` : `Play ${row.name}`}
          aria-pressed={isPlaying}
          onClick={() => onAudition(row)}
        >
          {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        </button>
        <button
          type="button"
          className={SEEK_CLASS}
          disabled={seekSourceSec === null}
          title={row.state === 'heard' ? 'Play the video around this sound' : undefined}
          onClick={() => onPlayInVideo(row)}
        >
          <span className={`w-full truncate text-xs text-fg-primary${dimmed ? ' opacity-40' : ''}`}>{row.name}</span>
          {!hidesAnchor && (
            <span className={`w-full truncate text-3xs text-fg-muted tabular-nums${dimmed ? ' opacity-40' : ''}`}>{row.anchor}</span>
          )}
        </button>
        {row.badge !== null && row.state !== 'heard' && <StatusPill label={row.badge} tone={PILL_TONE[row.state]} />}
        {goTo !== null && (
          <Tooltip text={goTo.label}>
            <button type="button" className={ROW_ICON_BUTTON_CLASS} aria-label={goTo.label} onClick={goTo.onGo}>
              <ArrowUpRight size={13} />
            </button>
          </Tooltip>
        )}
        <AudioClipMenu
          mode="effect"
          projectId={projectId}
          changeLabel="Change sound"
          changeIcon={<AudioLines size={13} />}
          onChange={(source) => actions.patchClips.execute([clip.id], { source, inSec: 0 })}
          onRemove={() => actions.removeClips.execute([clip.id])}
          onMoveToPlayhead={() => onMoveToPlayhead(clip.id)}
          trigger={<button type="button" className={ROW_ICON_BUTTON_CLASS} aria-label={`${row.name} options`}><MoreHorizontal size={14} /></button>}
        />
      </div>
      <div className="pl-8 pr-1">
        <Slider compact label="Volume" value={presenter.percentOf(clip.volume)} min={0} max={200} step={1} unit="%"
          onChange={(percent) => actions.patchClips.execute([clip.id], { volume: presenter.gainOf(percent) })} />
      </div>
      <div className="pl-8 pr-1 flex items-center gap-2">
        <span className="text-xs text-fg-muted min-w-[70px] shrink-0">Offset</span>
        <span className="flex-1" />
        <Tooltip text="Earlier">
          <button type="button" className={ROW_ICON_BUTTON_CLASS} aria-label="Play earlier" disabled={!row.canNudgeEarlier} onClick={() => nudge(-1)}>
            <ChevronLeft size={13} />
          </button>
        </Tooltip>
        <span className={`${FIGURE_CLASS} w-12 text-center`} aria-label="Offset">{row.offsetLabel}</span>
        <Tooltip text="Later">
          <button type="button" className={ROW_ICON_BUTTON_CLASS} aria-label="Play later" disabled={!row.canNudgeLater} onClick={() => nudge(1)}>
            <ChevronRight size={13} />
          </button>
        </Tooltip>
      </div>
    </li>
  );
});
