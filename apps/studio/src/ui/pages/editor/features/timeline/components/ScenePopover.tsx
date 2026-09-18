import type { ReactElement } from 'react';
import { Scissors, Sparkles, TextSelect } from 'lucide-react';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { SCENE_SURFACE_ATTRIBUTE } from '@ui/pages/editor/features/timeline/hooks/useReleaseHeldSceneOutside';

const SCREEN_CLASS = 'p-2 flex flex-col gap-1.5 w-[200px] box-border';

const ACTION_BTN =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap '
  + 'text-fg-secondary transition-colors duration-quick ease-standard '
  + 'hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary';

const HINT_CLASS = 'text-3xs text-fg-faint leading-snug px-2 pb-0.5 m-0';

interface ScenePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  durationSec: number;
  /** The scene's bar, which anchors the menu and opens it when pressed. */
  trigger: ReactElement;
  /** Where inside the bar it was pressed, in pixels from the bar's left edge. */
  pressOffsetPx: number;
  onSelectScene: () => void;
  onRedistributeWords: () => void;
  onCutScene: () => void;
}

/**
 * What can be done with one scene, beyond dragging its edges.
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
  onRedistributeWords,
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
            <p className={HINT_CLASS}>Drag its ends to change its timing.</p>
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
