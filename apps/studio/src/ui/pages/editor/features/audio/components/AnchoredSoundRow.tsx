import { memo } from 'react';
import { ChevronLeft, ChevronRight, Play, Square, Trash2 } from 'lucide-react';
import type { AnchoredSoundView, AnchoredSoundsPresenter } from '@presentation/audio-mix/services/AnchoredSoundsPresenter';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { FIGURE_CLASS, ROW_ICON_BUTTON_CLASS } from '@ui/pages/editor/features/audio/audio-classes';
import { soundSpotlightKey } from '@ui/pages/editor/features/audio/soundSpotlightKey';
import { useSpotlightTarget } from '@ui/pages/editor/features/element/useSpotlightTarget';

interface AnchoredSoundRowProps {
  sound: AnchoredSoundView;
  presenter: AnchoredSoundsPresenter;
  isPlaying: boolean;
  onAudition: () => void;
  /** Whether it offers the nudge earlier or later; where it is off, the sound plays where it was placed. */
  nudges?: boolean;
}

const ROW_CLASS = 'flex flex-col gap-1 py-1 border-t border-edge-faint first:border-t-0';

/**
 * One sound effect beside what it is on: a button that plays it, its
 * name, a nudge that moves it a little earlier or later (unless left
 * out), a button that removes it, and its level.
 */
export const AnchoredSoundRow = memo(function AnchoredSoundRow({ sound, presenter, isPlaying, onAudition, nudges = true }: AnchoredSoundRowProps) {
  const { actions } = useAudioMix();
  const { clip } = sound;
  const nudge = (steps: number) => actions.patchClips.execute([clip.id], {
    startOffsetSec: presenter.nudged(clip.start, steps),
  });
  const spotlight = useSpotlightTarget<HTMLLIElement>(soundSpotlightKey(clip.id));
  return (
    <li ref={spotlight} className={ROW_CLASS}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={ROW_ICON_BUTTON_CLASS}
          aria-label={isPlaying ? `Stop ${sound.name}` : `Play ${sound.name}`}
          aria-pressed={isPlaying}
          onClick={onAudition}
        >
          {isPlaying ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        </button>
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="truncate text-xs text-fg-primary" title={sound.name}>{sound.name}</span>
          {sound.placeNote !== null && <span className="truncate text-3xs text-fg-muted">{sound.placeNote}</span>}
        </span>
        {nudges && (
          <>
            <Tooltip text="Earlier">
              <button type="button" className={ROW_ICON_BUTTON_CLASS} aria-label="Play earlier" disabled={!sound.canNudgeEarlier} onClick={() => nudge(-1)}>
                <ChevronLeft size={13} />
              </button>
            </Tooltip>
            <span className={`${FIGURE_CLASS} w-12 text-center`} aria-label="Offset">{sound.nudgeLabel}</span>
            <Tooltip text="Later">
              <button type="button" className={ROW_ICON_BUTTON_CLASS} aria-label="Play later" disabled={!sound.canNudgeLater} onClick={() => nudge(1)}>
                <ChevronRight size={13} />
              </button>
            </Tooltip>
          </>
        )}
        <Tooltip text="Remove">
          <button type="button" className={ROW_ICON_BUTTON_CLASS} aria-label={`Remove ${sound.name}`} onClick={() => actions.removeClips.execute([clip.id])}>
            <Trash2 size={13} />
          </button>
        </Tooltip>
      </div>
      <div className="pl-8 pr-1">
        <Slider
          compact
          label="Volume"
          value={sound.volumePercent}
          min={0}
          max={200}
          step={1}
          unit="%"
          onChange={(percent) => actions.patchClips.execute([clip.id], { volume: presenter.gainOf(percent) })}
        />
      </div>
    </li>
  );
});
