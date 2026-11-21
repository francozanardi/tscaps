import { memo, useCallback, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Document } from '@tscaps/engine';
import { SHEET_ANIMATION_SCOPES, type ElementAnimationPhase } from '@core/elements/domain/ElementAnimationScope';
import { MotionScopeLayout, type MotionPart } from '@presentation/editor/services/MotionScopeLayout';
import { ANIMATED_PART_LABELS } from '@ui/_shared/components/element-fields/ElementKindLabels';
import { MotionPanelFrame, type MotionPartOption } from '@ui/_shared/components/element-fields/MotionPanelFrame';
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

const RESET_CLASS =
  'inline-flex items-center justify-center w-6 h-6 mb-1 rounded-xs bg-transparent border-none '
  + 'text-fg-faint cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-fg-secondary focus-visible:outline-none focus-visible:text-fg-secondary';

const LAYOUT = new MotionScopeLayout(SHEET_ANIMATION_SCOPES);
// A sheet is not an element, so every part it answers is a kind of one.
const PARTS: ReadonlyArray<MotionPartOption> = LAYOUT.parts().flatMap(
  (part) => (part === 'self' ? [] : [{ value: part, label: ANIMATED_PART_LABELS[part] }]),
);

/**
 * How everything under the active sheet moves, as it comes in and as it
 * leaves, one kind of element at a time.
 *
 * The same questions the inspector asks of one caption, asked once for
 * all of them. What is answered here is what an element falls back to,
 * so answering a scene in particular still wins.
 *
 * Picking plays the caption on screen, because a still frame says
 * nothing about motion. When the playhead sits between scenes there is
 * nothing to play and the pick lands silently — the alternative is
 * jumping the playhead somewhere the user was not looking. Nothing is
 * played while the user is playing the video themselves.
 *
 * Reset sits beside the strip rather than inside a panel: it is about
 * the kind and the end on show, and the panel below it has no heading of
 * its own to hang a button from — the strip and the part picker already
 * say what is being answered, so a title would only repeat them.
 */
export const MotionTab = memo(function MotionTab({ sheetScope, document }: MotionTabProps) {
  const sheet = sheetScope.activeSheet;
  const scripts = useSheetScripts(sheet);
  const onScreen = useActiveSegments(document)[0] ?? null;
  const replayWithinScene = useSceneReplay(onScreen?.time.end ?? 0);
  const customizedIds = useCustomizedControlIds(sheet);
  const { resetMotion } = useSheets().actions.style;
  const [end, setEnd] = useState<ElementAnimationPhase>('entrance');
  const [part, setPart] = useState<MotionPart>('segment');
  const scope = useMemo(() => LAYOUT.scopeAt(part, end), [part, end]);

  const replay = useCallback(() => {
    if (onScreen) replayWithinScene(onScreen.time.start, onScreen.time.end);
  }, [onScreen, replayWithinScene]);

  const reset = useCallback(() => {
    if (scope === null) return;
    resetMotion.execute(scope);
    replay();
  }, [resetMotion, scope, replay]);

  const partPicker = useMemo(() => ({ options: PARTS, picked: part, onPick: setPart }), [part]);
  const renderEnd = useCallback((shown: ElementAnimationPhase) => {
    const shownScope = LAYOUT.scopeAt(part, shown);
    if (shownScope === null) return null;
    return (
      <SheetAnimationSection
        sheet={sheet}
        scripts={scripts}
        scope={shownScope}
        customizedIds={customizedIds}
        onReplay={replay}
      />
    );
  }, [part, sheet, scripts, customizedIds, replay]);

  return (
    <EditorTab title="Motion" hideTitleRow sheetScope={sheetScope}>
      <MotionPanelFrame
        ends={LAYOUT.ends()}
        end={end}
        onEndChange={setEnd}
        partPicker={partPicker}
        headerAction={(
          <Tooltip text="Reset to template default">
            <button type="button" onClick={reset} aria-label="Reset to template default" className={RESET_CLASS}>
              <RotateCcw size={13} strokeWidth={2} />
            </button>
          </Tooltip>
        )}
        renderEnd={renderEnd}
      />
    </EditorTab>
  );
});
