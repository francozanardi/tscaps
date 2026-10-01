import type { ReactElement } from 'react';
import { ChevronsLeft, ChevronsRight, Scissors, Sparkles, TextSelect, WholeWord } from 'lucide-react';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { SCENE_SURFACE_ATTRIBUTE } from '@ui/pages/editor/features/timeline/hooks/useReleaseHeldSceneOutside';

const SCREEN_CLASS = 'p-2 flex flex-col gap-1.5 w-[200px] box-border';

const ACTION_BTN =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap '
  // An icon is a flex item like any other, and a label too long for the
  // menu would otherwise squeeze it to nothing.
  + '[&>svg]:shrink-0 '
  + 'text-fg-secondary transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary';

const HINT_CLASS = 'text-3xs text-fg-faint leading-snug px-2 pb-0.5 m-0';

// Beside the entry it is a shortcut for, and only because it does exactly
// what the entry does.
const SHORTCUT_CLASS = 'shrink-0 text-3xs text-fg-faint';

interface ScenePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  durationSec: number;
  /** The scene's block, which anchors the menu and opens it when pressed. */
  trigger: ReactElement;
  /** Where inside the block it was pressed, in pixels from its left edge. */
  pressOffsetPx: number;
  onSelectScene: () => void;
  /** Opens the scene word by word, in place. */
  onEditWords: () => void;
  onRedistributeWords: () => void;
  /** Takes hold of the scene together with every scene before it. */
  onSelectBackward: () => void;
  /** Takes hold of the scene together with every scene after it. */
  onSelectOnward: () => void;
  onCutScene: () => void;
}

/**
 * What can be done with one scene, beyond dragging it or its edges.
 *
 * The scene's own window is deliberately **not** editable here. It is
 * changed by pulling its ends, which is both easier and truthful about
 * what it does; repeating it as a numeric screen would teach the slower
 * way first and leave the handles looking like a shortcut for experts.
 * The duration is stated instead, since it is the number the handles
 * are moving.
 *
 * Redistributing the words inside it is a different case and belongs
 * here: no drag on the track expresses it, since it retimes every word
 * at once against how fast the speaker talks.
 */
export function ScenePopover({
  open,
  onOpenChange,
  durationSec,
  trigger,
  pressOffsetPx,
  onSelectScene,
  onEditWords,
  onRedistributeWords,
  onSelectBackward,
  onSelectOnward,
  onCutScene,
}: ScenePopoverProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      alignOffset={pressOffsetPx}
      screens={{
        menu: (
          // A portal moves the DOM node out but not the React tree, so a
          // press here still reaches the timeline, which reads it as a
          // range drag and captures the pointer — swallowing the release
          // the button under the finger was waiting for.
          <div
            className={SCREEN_CLASS}
            {...{ [SCENE_SURFACE_ATTRIBUTE]: '' }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <PopoverHeader title={`Scene · ${durationSec.toFixed(2)}s`} />
            {/* Shift-drag is written here, beside the other drags, and not
                beside selecting the group: it moves the group, it selects
                nothing. */}
            <p className={HINT_CLASS}>Drag to move, ends to retime. Shift-drag moves all after.</p>
            <button
              type="button"
              className={ACTION_BTN}
              onClick={() => { onOpenChange(false); onEditWords(); }}
            >
              <WholeWord size={14} />
              <span className="flex-1">Edit words</span>
              <span className={SHORTCUT_CLASS}>Double-click</span>
            </button>
            <button
              type="button"
              className={ACTION_BTN}
              onClick={() => { onOpenChange(false); onSelectScene(); }}
            >
              <TextSelect size={14} />
              <span className="flex-1">Select its range</span>
            </button>
            <button
              type="button"
              className={ACTION_BTN}
              onClick={() => { onOpenChange(false); onSelectBackward(); }}
            >
              <ChevronsLeft size={14} />
              <span className="flex-1">Select this and all before</span>
            </button>
            <button
              type="button"
              className={ACTION_BTN}
              onClick={() => { onOpenChange(false); onSelectOnward(); }}
            >
              <ChevronsRight size={14} />
              <span className="flex-1">Select this and all after</span>
            </button>
            <button
              type="button"
              className={ACTION_BTN}
              onClick={() => { onOpenChange(false); onRedistributeWords(); }}
            >
              <Sparkles size={14} />
              <span className="flex-1">Redistribute its words</span>
            </button>
            <button
              type="button"
              className={ACTION_BTN}
              onClick={() => { onOpenChange(false); onCutScene(); }}
            >
              <Scissors size={14} />
              <span className="flex-1">Cut this scene</span>
            </button>
          </div>
        ),
      }}
    />
  );
}
