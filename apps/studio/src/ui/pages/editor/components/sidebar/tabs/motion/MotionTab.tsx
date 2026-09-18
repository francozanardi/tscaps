import { memo, useCallback, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { RotateCcw } from 'lucide-react';
import type { Document } from '@tscaps/engine';
import { ElementAnimationScope, SHEET_ANIMATION_SCOPES } from '@core/elements/domain/ElementAnimationScope';
import { ANIMATION_SCOPE_LABELS } from '@ui/_shared/components/element-fields/ElementKindLabels';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { SheetAnimationSection } from '@ui/pages/editor/components/sidebar/tabs/motion/SheetAnimationSection';
import { useActiveSegments } from '@ui/_shared/contexts/EditorStoreContext';
import { useCustomizedControlIds } from '@ui/pages/editor/hooks/useCustomizedControlIds';
import { useSceneReplay } from '@ui/pages/editor/hooks/useSceneReplay';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useSheetScripts } from '@ui/_shared/hooks/useSheetScripts';

interface MotionTabProps {
  sheetScope: SheetScope;
  document: Document | null;
}

const STRIP_ROW_CLASS = 'flex items-end justify-between gap-2 border-b border-edge-subtle mb-3';
const STRIP_CLASS = 'flex gap-4';
// No focus ring. Radix moves focus onto the trigger it activates, so a
// plain click leaves one behind — and the tab a ring would point at is
// the one the accent underline already marks, since selection follows
// focus here.
const STRIP_TAB_CLASS =
  'relative pb-2 bg-transparent border-none cursor-pointer text-xs '
  + 'transition-colors duration-quick ease-standard outline-none '
  + 'text-fg-muted hover:text-fg-secondary '
  + 'data-[state=active]:text-accent '
  + 'after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-transparent '
  + 'data-[state=active]:after:bg-accent';
const RESET_CLASS =
  'inline-flex items-center justify-center w-6 h-6 mb-1 rounded-xs bg-transparent border-none '
  + 'text-fg-faint cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-fg-secondary focus-visible:outline-none focus-visible:text-fg-secondary';

/**
 * How everything under the active sheet moves, one kind of element at
 * a time.
 *
 * The same three questions the Properties panel asks of one caption,
 * asked once for all of them. What is answered here is what an element
 * falls back to, so answering a scene in particular still wins.
 *
 * Picking plays the caption on screen, because a still frame says
 * nothing about motion. When the playhead sits between scenes there is
 * nothing to play and the pick lands silently — the alternative is
 * jumping the playhead somewhere the user was not looking. Nothing is
 * played while the user is playing the video themselves.
 *
 * Reset sits beside the strip rather than inside a panel: it is about
 * the kind the strip has open, and the panel below it has no heading of
 * its own to hang a button from — the strip already says what is being
 * answered, so a second title would only repeat it.
 */
export const MotionTab = memo(function MotionTab({ sheetScope, document }: MotionTabProps) {
  const sheet = sheetScope.activeSheet;
  const scripts = useSheetScripts(sheet);
  const onScreen = useActiveSegments(document)[0] ?? null;
  const replayWithinScene = useSceneReplay(onScreen?.time.end ?? 0);
  const customizedIds = useCustomizedControlIds(sheet);
  const { resetMotion } = useSheets().actions.style;
  const [picked, setPicked] = useState<ElementAnimationScope>(ElementAnimationScope.SEGMENTS);

  const replay = useCallback(() => {
    if (onScreen) replayWithinScene(onScreen.time.start, onScreen.time.end);
  }, [onScreen, replayWithinScene]);

  const reset = useCallback(() => {
    resetMotion.execute(picked);
    replay();
  }, [resetMotion, picked, replay]);

  return (
    <EditorTab title="Motion" hideTitleRow sheetScope={sheetScope}>
      <Tabs.Root value={picked} onValueChange={(value) => setPicked(value as ElementAnimationScope)}>
        <div className={STRIP_ROW_CLASS}>
          <Tabs.List className={STRIP_CLASS} aria-label="What moves">
            {SHEET_ANIMATION_SCOPES.map((scope) => (
              <Tabs.Trigger key={scope} value={scope} className={STRIP_TAB_CLASS}>
                {ANIMATION_SCOPE_LABELS[scope]}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <Tooltip text="Reset to template default">
            <button type="button" onClick={reset} aria-label="Reset to template default" className={RESET_CLASS}>
              <RotateCcw size={13} strokeWidth={2} />
            </button>
          </Tooltip>
        </div>
        {SHEET_ANIMATION_SCOPES.map((scope) => (
          <Tabs.Content key={scope} value={scope}>
            <SheetAnimationSection
              scripts={scripts}
              scope={scope}
              animations={sheet.animations}
              declaredAnimations={sheet.template.declaredAnimations}
              styleControls={sheet.template.styleControls}
              animationSupport={sheet.template.features.animation}
              styleValues={sheet.styleValues}
              customizedIds={customizedIds}
              onReplay={replay}
            />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </EditorTab>
  );
});
