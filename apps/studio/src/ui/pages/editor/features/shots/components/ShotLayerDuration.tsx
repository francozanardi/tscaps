import { useState, type FocusEvent } from 'react';
import { Check, Timer } from 'lucide-react';
import { ShotLayerLabels } from '@presentation/shots/services/ShotLayerLabels';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { POPOVER_ITEM, POPOVER_MENU_SHAPE } from '@ui/pages/editor/features/transcript/transcript-classes';
import { ShotRunBar, type ShotRunSpan } from '@ui/pages/editor/features/shots/components/ShotRunBar';

/** A shot a layer can end with: its own, or one after it. */
export interface ShotLayerDurationChoice {
  /** The shot's number, as the cards count them. */
  readonly shotNumber: number;
  /** What is said in the shot, to tell it from its neighbours; empty where nothing is. */
  readonly text: string;
  /** How long the layer shows where it ends with this shot, in seconds of the output. */
  readonly durationSec: number;
  /** Whether the layer ends with this shot now. */
  readonly picked: boolean;
  /** Has the layer end with this shot. */
  readonly onPick: () => void;
}

/** Showing over the whole video, from its first shot through its last, as a layer can be asked to. */
export interface ShotLayerWholeVideoChoice {
  /** Whether the layer shows over the whole video now. */
  readonly picked: boolean;
  /** How long the whole video plays, in seconds. */
  readonly durationSec: number;
  /** Has the layer show over the whole video, wherever it was. */
  readonly onPick: () => void;
}

/** How long a layer shows, in shots, and the shots it could end with: its own first, then each one after it. */
export interface ShotLayerDurationData {
  /** Every shot of the video, in order, by how long it plays in the output, in seconds. */
  readonly shotLengthsSec: ReadonlyArray<number>;
  /** Never empty. Leaves out a run from the first shot through the last, which {@link wholeVideo} stands for. */
  readonly choices: ReadonlyArray<ShotLayerDurationChoice>;
  /** The whole video as a choice; null where it is not one to offer. */
  readonly wholeVideo: ShotLayerWholeVideoChoice | null;
}

/** The popover screen {@link ShotLayerDurationItem} opens. */
export const SHOT_LAYER_DURATION_SCREEN = 'layer-duration';

const LABELS = new ShotLayerLabels();
const SECONDS_CLASS = 'shrink-0 ml-auto pl-2 font-mono text-3xs text-fg-faint tabular-nums';

/**
 * How long a layer shows, as a row of its menu: the shots it shows on,
 * or *Whole video*, and a press away the list to change it.
 */
export function ShotLayerDurationItem(data: ShotLayerDurationData) {
  const { navigate } = usePopoverNav();
  const ownShotNumber = data.choices[0]!.shotNumber;
  const summary = data.wholeVideo?.picked
    ? 'Whole video'
    : LABELS.runOf(ownShotNumber, data.choices.find((choice) => choice.picked)?.shotNumber ?? ownShotNumber);
  return (
    <button className={POPOVER_ITEM} onClick={() => navigate(SHOT_LAYER_DURATION_SCREEN)}>
      <Timer size={13} className="shrink-0" /> Duration
      <span className="ml-auto pl-2 min-w-0 truncate text-fg-faint">{summary}</span>
    </button>
  );
}

/**
 * How long a layer shows, picked as a stretch of shots: *Whole video*
 * first where it is offered, then the layer's own shot alone and each
 * longer run from it, every one with how long it lasts and what is
 * said where it ends. A line of the video's shots on top shows the
 * stretch picked, and the one under the pointer before it is picked.
 * No time is ever typed here, only a shot picked, and no cut moves.
 */
export function ShotLayerDurationScreen({ shotLengthsSec, choices, wholeVideo }: ShotLayerDurationData) {
  const { close } = usePopoverNav();
  const [previewed, setPreviewed] = useState<ShotRunSpan | null>(null);
  const fromIndex = choices[0]!.shotNumber - 1;
  const lastIndex = shotLengthsSec.length - 1;
  const overWholeVideo = wholeVideo?.picked === true;
  const picked = choices.find((choice) => choice.picked);
  const current: ShotRunSpan = overWholeVideo
    ? { fromIndex: 0, throughIndex: lastIndex }
    : { fromIndex, throughIndex: (picked?.shotNumber ?? fromIndex + 1) - 1 };
  const previewOn = (span: ShotRunSpan) => ({
    // On a move rather than an enter: the row that opens under a pointer at rest is not one it reached for.
    onPointerMove: () => setPreviewed((shown) => (
      shown?.fromIndex === span.fromIndex && shown.throughIndex === span.throughIndex ? shown : span
    )),
    onPointerLeave: () => setPreviewed(null),
    // Only a focus the keyboard moved: the one the popover gives its first row on opening is not a reach for it.
    onFocus: (event: FocusEvent<HTMLButtonElement>) => {
      if (event.currentTarget.matches(':focus-visible')) setPreviewed(span);
    },
    onBlur: () => setPreviewed(null),
  });
  return (
    <div className={`${POPOVER_MENU_SHAPE} w-[300px]`}>
      <div className="px-1 pt-0.5 pb-1 flex flex-col gap-2">
        <PopoverHeader title="Duration" />
        <div className="px-1 pb-1">
          <ShotRunBar shotLengthsSec={shotLengthsSec} covered={previewed ?? current} tone="accent" />
        </div>
      </div>
      {wholeVideo !== null && (
        <>
          <button
            className={POPOVER_ITEM}
            aria-pressed={overWholeVideo}
            onClick={() => { wholeVideo.onPick(); close(); }}
            {...previewOn({ fromIndex: 0, throughIndex: lastIndex })}
          >
            <Check size={13} className={`shrink-0 text-accent ${overWholeVideo ? '' : 'invisible'}`} aria-hidden />
            Whole video
            <span className={SECONDS_CLASS}>{wholeVideo.durationSec.toFixed(1)}s</span>
          </button>
          <div className="mx-2 my-1 border-t border-edge-subtle" />
        </>
      )}
      <div className="thin-scroll flex flex-col gap-0.5 max-h-[240px] overflow-y-auto">
        {choices.map((choice) => {
          const isPicked = choice.picked && !overWholeVideo;
          return (
            <button
              key={choice.shotNumber}
              className={POPOVER_ITEM}
              aria-pressed={isPicked}
              onClick={() => { choice.onPick(); close(); }}
              {...previewOn({ fromIndex, throughIndex: choice.shotNumber - 1 })}
            >
              <Check size={13} className={`shrink-0 text-accent ${isPicked ? '' : 'invisible'}`} aria-hidden />
              <span className="shrink-0 tabular-nums">{LABELS.runOf(fromIndex + 1, choice.shotNumber)}</span>
              <span className="min-w-0 truncate text-fg-faint">{choice.text}</span>
              <span className={SECONDS_CLASS}>{choice.durationSec.toFixed(1)}s</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
