import { useMemo } from 'react';
import { Ban, Plus } from 'lucide-react';
import {
  SHOT_TRANSITION_KINDS,
  SHOT_TRANSITION_RECOMMENDED_DURATION_SEC,
  type ShotTransition,
  type ShotTransitionKind,
} from '@core/shots/domain/ShotTransition';
import { ShotTransitionSanitizer } from '@core/shots/domain/ShotTransitionSanitizer';
import { Slider } from '@ui/_shared/components/controls/fields/Slider';
import { AnimationCardGrid } from '@ui/_shared/components/element-fields/AnimationCardGrid';
import { ElementAnimationCard } from '@ui/_shared/components/element-fields/ElementAnimationCard';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { AnchoredSoundList } from '@ui/pages/editor/features/audio/components/AnchoredSoundList';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import { POPOVER_ITEM } from '@ui/pages/editor/features/transcript/transcript-classes';
import { ShotTransitionIcon } from '@ui/pages/editor/features/shots/components/ShotTransitionIcon';
import { useShotTransitionReplay } from '@ui/pages/editor/features/shots/hooks/useShotTransitionReplay';

interface ShotTransitionPanelProps {
  shotId: string;
  /** The transition into the shot now, or null for a plain cut. */
  transition: ShotTransition | null;
}

export const SHOT_TRANSITION_LABELS: Readonly<Record<ShotTransitionKind, string>> = {
  'flash': 'Flash',
  'fade-white': 'Dip to white',
  'fade-black': 'Dip to black',
  'blur': 'Blur',
  'whip': 'Whip',
  'whip-up': 'Whip up',
  'spin': 'Spin',
  'shake': 'Shake',
  'glitch': 'Glitch',
  'wipe': 'Wipe',
  'iris': 'Iris',
};

const GLYPH_SIZE = 22;
const ICON_SIZE = 48;
// As tall as the room the popover has, scrolling past it: the sound list below the cards can grow. The
// scrollbar's room is kept whether it shows or not, so nothing moves when it appears.
const PANEL_CLASS = 'w-[344px] max-w-[calc(100vw-32px)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto '
  + '[scrollbar-gutter:stable] p-3 flex flex-col gap-3 '
  + 'thin-scroll [scrollbar-width:thin] [scrollbar-color:rgb(var(--color-fg-faint)/0.25)_transparent]';
const TITLE_CLASS = 'm-0 font-mono text-2xs uppercase tracking-[0.06em] text-fg-faint';
const SOUND_TITLE_CLASS = 'm-0 text-xs text-fg-secondary';
/** The popover screen that picks a sound for the cut. */
export const SHOT_TRANSITION_SOUND_SCREEN = 'sound';

/**
 * How the picture passes into a shot from the one before: cards in the
 * motion cards' language, *None* first, then how long it takes and the
 * transition's own sounds (not those on the shot's start), each with its
 * level and its removal, as every sound on an anchor is shown, without
 * the nudge, plus a way to add one.
 * A card picked starts at its kind's recommended length (the card
 * already picked keeps its own) and plays the cut again, with its
 * sound. A first pick comes
 * with the sound its kind suggests, where it suggests one; picking
 * another kind swaps that sound for the new kind's, unless it was
 * taken off.
 */
export function ShotTransitionPanel({ shotId, transition }: ShotTransitionPanelProps) {
  const { actions, services } = useShots();
  const audio = useEditorAudioMix();
  const presenter = useAnchoredSoundsPresenter();
  const { navigate } = usePopoverNav();
  const replay = useShotTransitionReplay(shotId);
  const keepsSound = services.transitionSounds.keepsSound(audio, shotId, transition);
  const anchor = useMemo(() => presenter.transitionAnchor(shotId), [presenter, shotId]);

  const pick = (kind: ShotTransitionKind | null) => {
    if (kind === null) {
      actions.setTransition.execute(shotId, null, false);
      return;
    }
    // Each kind starts at its own recommended length, whatever the one
    // before was set to; the kind already picked keeps the length it has.
    const durationSec = transition?.kind === kind ? transition.durationSec : SHOT_TRANSITION_RECOMMENDED_DURATION_SEC[kind];
    actions.setTransition.execute(shotId, { kind, durationSec }, keepsSound);
    replay();
  };

  return (
    <div className={PANEL_CLASS}>
      <p className={TITLE_CLASS}>Transition</p>
      <AnimationCardGrid label="Transition" fixedColumns>
        <ElementAnimationCard
          label="None"
          selected={transition === null}
          icon={<Ban size={GLYPH_SIZE} strokeWidth={1.5} />}
          onSelect={() => pick(null)}
        />
        {SHOT_TRANSITION_KINDS.map((kind) => (
          <ElementAnimationCard
            key={kind}
            label={SHOT_TRANSITION_LABELS[kind]}
            selected={transition?.kind === kind}
            icon={<ShotTransitionIcon kind={kind} size={ICON_SIZE} />}
            onSelect={() => pick(kind)}
          />
        ))}
      </AnimationCardGrid>
      {transition !== null && (
        <>
          <Slider
            label="Duration"
            value={transition.durationSec}
            min={ShotTransitionSanitizer.MIN_DURATION_SEC}
            max={ShotTransitionSanitizer.MAX_DURATION_SEC}
            step={0.05}
            unit="s"
            onChange={(durationSec) => actions.setTransition.execute(shotId, { ...transition, durationSec }, keepsSound)}
          />
          <div className="flex flex-col gap-1">
            <p className={SOUND_TITLE_CLASS}>Sound</p>
            <AnchoredSoundList anchor={anchor} nudges={false} />
            <button type="button" className={POPOVER_ITEM} onClick={() => navigate(SHOT_TRANSITION_SOUND_SCREEN)}>
              <Plus size={13} /> {presenter.soundCountOn(audio, anchor) === 0 ? 'Add sound' : 'Add another sound'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
