import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import type { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { SegmentTextareaFocuser } from '@presentation/editor/services/SegmentTextareaFocuser';
import { SegmentTextareaArrowNavigationController } from '@presentation/editor/controllers/SegmentTextareaArrowNavigationController';
import { ScenePickController } from '@presentation/editor/controllers/ScenePickController';
import { TranscriptPanel } from '@ui/pages/editor/features/transcript/components/TranscriptPanel';
import { EditorTab } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { ScenePickProvider } from '@ui/pages/editor/features/transcript/contexts/ScenePickContext';
import { useScenePickSnapshot } from '@ui/pages/editor/features/transcript/hooks/useScenePickSnapshot';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { useCuts } from '@ui/_shared/contexts/modules/CutsContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useEditorCuts } from '@ui/_shared/contexts/EditorStoreContext';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';

interface TranscriptHostProps {
  document: Document | null;
  activeSegmentId: string | null;
  sheets: Sheet[];
  elementStyles: ElementStyles;
  behindActorOverrides: BehindActorSegmentOverrideRegistry;
  frozenSegments: FrozenSegmentSet;
  decorationOverrides: DecorationOverrideRegistry;
  videoDuration: number;
  isPlaying: boolean;
}

/**
 * Wires the textarea focuser and arrow-navigation controller that the
 * transcript subtab needs to coordinate caret behaviour across segment
 * textareas, binds every action callback the panel consumes to the
 * captions / sheets / playback contexts, and owns the tab shell
 * (EditorTab title + scene pick controller) so the title can bow out
 * while the pick chrome is up.
 */
export function TranscriptHost(props: TranscriptHostProps) {
  const captions = useCaptions();
  const cuts = useCuts();
  const cutRegistry = useEditorCuts();
  const sheets = useSheets();
  const playback = usePlayback();
  const elements = useElements();
  const textareaFocus = useMemo(() => new SegmentTextareaFocuser(), []);
  const textareaArrowNav = useMemo(() => new SegmentTextareaArrowNavigationController(), []);
  const scenePickController = useMemo(() => new ScenePickController(), []);
  const [bulkModeActive, setBulkModeActive] = useState(false);
  useEffect(() => {
    textareaArrowNav.start();
    return () => textareaArrowNav.stop();
  }, [textareaArrowNav]);

  return (
    <ScenePickProvider value={scenePickController}>
      <TranscriptTabShell bulkModeActive={bulkModeActive}>
        <TranscriptPanel
          {...props}
          cuts={cutRegistry}
          cutAwareDocumentBuilder={cuts.services.cutAwareDocumentBuilder}
          textareaFocus={textareaFocus}
          onSeek={playback.seek}
          onDeleteWords={(ids) => captions.actions.words.delete.execute(ids)}
          onApplyStructureEdit={(doc) => captions.actions.segments.applyStructureEdit.execute(doc)}
          onInsertWord={(segIdx, lineIdx, wordIdx) => captions.actions.words.insert.execute(segIdx, lineIdx, wordIdx)}
          onInsertSegment={(anchorRef, position) => captions.actions.segments.insert.execute(anchorRef, position)}
          onEditWordText={(id, text) => captions.actions.words.editText.execute(id, text)}
          onEditWordTime={(id, start, end) => captions.actions.words.editTime.execute(id, start, end)}
          onEditWordTags={(id, tagNames) => captions.actions.words.editTags.execute(id, tagNames)}
          onAssignSegmentSheet={(seg: Segment, sheetId) => {
            sheets.actions.sheets.assignSegment.execute(seg, sheetId);
            playback.seek(seg.time.midpoint);
          }}
          onCreateSheet={(name) => sheets.actions.sheets.create.execute(name)}
          onResetSegmentLayout={(id) => captions.actions.segments.resetLayout.execute(id)}
          onEditSelectedWordTag={(wordIds, tagName, enabled) => {
            captions.actions.words.editSelectedTag.execute({ wordIds, tagName, enabled });
          }}
          onSetSelectedBehindActor={(segmentIds, override) => {
            captions.actions.segments.setSelectedBehindActorOverride.execute({ segmentIds, override });
          }}
          onAssignSelectedSegmentsSheet={(segmentIds, sheetId) => {
            sheets.actions.sheets.assignSelectedSegments.execute(sheetId, segmentIds);
          }}
          onSetSelectedStyleField={(elementIds, kind, control, value) => {
            elements.actions.setField.execute(elementIds, kind, control, value);
          }}
          onBulkModeChange={setBulkModeActive}
        />
      </TranscriptTabShell>
    </ScenePickProvider>
  );
}

/**
 * Renders the EditorTab shell around the transcript body, hiding the
 * static "Transcript" title while a scene pick session's own chrome is
 * on-screen — the two rows on top of each other would otherwise fight.
 */
function TranscriptTabShell({ children, bulkModeActive }: { children: ReactNode; bulkModeActive: boolean }) {
  const pickSnapshot = useScenePickSnapshot();
  return (
    <EditorTab title="Transcript" hideTitleRow={pickSnapshot.isActive || bulkModeActive}>
      {children}
    </EditorTab>
  );
}
