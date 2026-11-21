import { AudioLines, ChevronsUp, ChevronsDown, SplitSquareVertical } from 'lucide-react';
import type { AudioAnchor } from '@core/audio-mix/domain/AudioAnchor';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { AddSoundScreen } from '@ui/pages/editor/features/audio/components/AddSoundScreen';
import { AnchoredSoundList } from '@ui/pages/editor/features/audio/components/AnchoredSoundList';
import { useAnchoredSoundsPresenter } from '@ui/pages/editor/features/audio/hooks/useAnchoredSoundsPresenter';
import {
  POPOVER_MENU_SHAPE,
  POPOVER_ITEM,
  POPOVER_ITEM_MOVE,
} from '@ui/pages/editor/features/transcript/transcript-classes';

export interface ShotWordActions {
  /** Opens a shot at this word. Absent on the word its shot already opens on. */
  onSplit: (() => void) | null;
  /** Hands the word to the shot above, which only its first word can be. */
  onMoveToPreviousShot: (() => void) | null;
  /** Hands it to the shot below, which only its last word can be. */
  onMoveToNextShot: (() => void) | null;
}

interface ShotWordSounds {
  /** Where a sound on this word is anchored: the start of the Original word. */
  soundAnchor: AudioAnchor;
  projectId: string | null;
}

interface ShotWordPopoverProps extends ShotWordActions, ShotWordSounds {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: { x: number; y: number };
}

const SOUND_TITLE = 'Sound at this word';

/**
 * What can be done at one word of a shot: open a new shot at it, hand
 * it to the shot above or below, or put a sound on it. The sounds it
 * carries are listed under the actions, each with its level, a nudge
 * and its removal.
 *
 * One way to split, not two: opening after a word is opening at the
 * next one.
 *
 * Moving is offered only at the edges, because that is the only place
 * it means anything — a word in the middle cannot leave without taking
 * the words around it.
 */
export function ShotWordPopover({ open, onOpenChange, point, soundAnchor, projectId, ...actions }: ShotWordPopoverProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      point={point}
      initialScreen="menu"
      screens={{
        menu: <ShotWordMenuScreen {...actions} soundAnchor={soundAnchor} projectId={projectId} />,
        sound: <AddSoundScreen title={SOUND_TITLE} anchor={soundAnchor} projectId={projectId} />,
      }}
    />
  );
}

function ShotWordMenuScreen({ onSplit, onMoveToPreviousShot, onMoveToNextShot, soundAnchor }: ShotWordActions & ShotWordSounds) {
  const { close, navigate } = usePopoverNav();
  const mix = useEditorAudioMix();
  const presenter = useAnchoredSoundsPresenter();
  const hasSounds = presenter.soundCountOn(mix, soundAnchor) > 0;
  const run = (action: () => void) => { action(); close(); };
  return (
    <div className={POPOVER_MENU_SHAPE}>
      {onSplit && (
        <button className={POPOVER_ITEM} onClick={() => run(onSplit)}>
          <SplitSquareVertical size={13} /> Start a new shot at this word
        </button>
      )}
      {onMoveToPreviousShot && (
        <button className={POPOVER_ITEM_MOVE} onClick={() => run(onMoveToPreviousShot)}>
          <ChevronsUp size={13} /> Move to previous shot
        </button>
      )}
      {onMoveToNextShot && (
        <button className={POPOVER_ITEM_MOVE} onClick={() => run(onMoveToNextShot)}>
          <ChevronsDown size={13} /> Move to next shot
        </button>
      )}
      <button className={POPOVER_ITEM} onClick={() => navigate('sound')}>
        <AudioLines size={13} /> Add sound at this word…
      </button>
      {hasSounds && (
        <div className="w-72 mt-1 pt-1 px-1 border-t border-edge-subtle">
          <AnchoredSoundList anchor={soundAnchor} />
        </div>
      )}
    </div>
  );
}
