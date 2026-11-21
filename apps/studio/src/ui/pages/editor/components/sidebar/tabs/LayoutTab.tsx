import { memo, useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import type { Document } from '@tscaps/engine';
import type { SegmentSplitterContext } from '@core/segment-splitter/domain/SegmentSplitterDescriptor';
import { EditorTab, type SheetScope } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { ModeLayoutFields, type ModeLayoutChange } from '@ui/pages/editor/components/sidebar/tabs/ModeLayoutFields';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';
import { TabStrip, type TabStripItem } from '@ui/_shared/components/TabStrip/TabStrip';
import type { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import { useSheetScripts } from '@ui/_shared/hooks/useSheetScripts';

interface LayoutTabProps {
  sheetScope: SheetScope;
  document: Document | null;
  frozenSegments: FrozenSegmentSet;
}

/** A layout change waiting on the confirm dialog, and the mode it is for (`null` for the body). */
interface PendingChange {
  readonly change: ModeLayoutChange;
  readonly modeTag: string | null;
}

/** The tab value of the body, beside the modes' tags. */
const BODY_TAB = 'body';
const STRIP_ROW_CLASS = 'flex items-end gap-2 h-8 border-b border-edge-subtle mb-2';
const LEGEND_CLASS = 'm-0 mb-2 text-2xs text-fg-muted';

/**
 * How the active sheet cuts its captions into scenes and breaks them
 * into lines. A sheet whose template designs modes beyond the body
 * shows one tab per mode, each with its own layout and the legend the
 * template gives it; any other sheet shows the body's fields alone.
 */
export const LayoutTab = memo(function LayoutTab({
  sheetScope,
  document,
  frozenSegments,
}: LayoutTabProps) {
  const sheets = useSheets();
  const captions = useCaptions();
  const { activeSheet } = sheetScope;
  const scripts = useSheetScripts(activeSheet);
  const modes = activeSheet.template.modes;
  const [shownTab, setShownTab] = useState<string>(BODY_TAB);

  const documentHasCues = useMemo(
    () => document?.getWords().some((word) => word.cueIndex !== null) ?? false,
    [document],
  );
  const splitterContext = useMemo<SegmentSplitterContext>(
    () => ({
      fontSize: activeSheet.typographyConfig.fontSize,
      referenceFontSize: activeSheet.template.typography.fontSize,
      documentHasCues,
    }),
    [activeSheet.typographyConfig.fontSize, activeSheet.template.typography.fontSize, documentHasCues],
  );

  // A splitter-field change reflows every scene in the sheet, dropping
  // any manual shape (frozen layout or style overrides). Surface a
  // confirm dialog only when there's something to lose.
  const activeSheetHasFrozen = useMemo(() => {
    if (!document) return false;
    for (const section of document.sections) {
      if (section.kind !== activeSheet.id) continue;
      for (const seg of section.segments) {
        if (frozenSegments.has(seg.id)) return true;
      }
    }
    return false;
  }, [document, activeSheet.id, frozenSegments]);

  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  const applyChange = ({ change, modeTag }: PendingChange): void => {
    if (change.kind === 'segment') sheets.actions.style.updateSegmentSplitter.execute(change.type, change.patch, modeTag);
    else sheets.actions.style.updateLineSplitter.execute(change.patch, modeTag);
  };

  const requestChange = (pending: PendingChange): void => {
    if (activeSheetHasFrozen) {
      setPendingChange(pending);
      return;
    }
    applyChange(pending);
  };

  const bodyFields = (
    <ModeLayoutFields
      segmentSplitterConfigs={activeSheet.segmentSplitterConfigs}
      lineSplitterConfig={activeSheet.lineSplitterConfig}
      splitterContext={splitterContext}
      scripts={scripts}
      onChange={(change) => requestChange({ change, modeTag: null })}
    />
  );

  const tabs: TabStripItem[] = [
    { value: BODY_TAB, label: modes.base.label },
    ...modes.extra.map((mode) => ({ value: mode.tag, label: mode.label })),
  ];
  const selectedTab = tabs.some((tab) => tab.value === shownTab) ? shownTab : BODY_TAB;

  return (
    <EditorTab
      title="Layout"
      sheetScope={sheetScope}
      onResetToTemplate={() => sheets.actions.style.resetSlice.execute('layout')}
    >
      {modes.extra.length === 0 ? bodyFields : (
        <Tabs.Root value={selectedTab} onValueChange={setShownTab}>
          <div className={STRIP_ROW_CLASS}>
            <TabStrip items={tabs} label="Which captions" />
          </div>
          <Tabs.Content value={BODY_TAB} className="outline-none">
            {modes.base.legend !== null && <p className={LEGEND_CLASS}>{modes.base.legend}</p>}
            {bodyFields}
          </Tabs.Content>
          {modes.extra.map((mode) => {
            const layout = activeSheet.modeLayout(mode.tag);
            if (!layout) return null;
            return (
              <Tabs.Content key={mode.tag} value={mode.tag} className="outline-none">
                {mode.legend !== null && <p className={LEGEND_CLASS}>{mode.legend}</p>}
                <ModeLayoutFields
                  segmentSplitterConfigs={layout.segmentSplitterConfigs}
                  lineSplitterConfig={layout.lineSplitterConfig}
                  splitterContext={splitterContext}
                  scripts={scripts}
                  onChange={(change) => requestChange({ change, modeTag: mode.tag })}
                />
              </Tabs.Content>
            );
          })}
        </Tabs.Root>
      )}
      <ConfirmDialog
        open={pendingChange !== null}
        message="Changing the layout will reflow every scene in this sheet. Manual line breaks, scene splits, and per-scene style overrides will be lost — text edits and timings are kept."
        confirmLabel="Apply"
        danger
        onConfirm={() => {
          if (!pendingChange) return;
          captions.actions.segments.resetSheetLayout.execute(activeSheet.id);
          applyChange(pendingChange);
          setPendingChange(null);
        }}
        onCancel={() => setPendingChange(null)}
      />
    </EditorTab>
  );
});
