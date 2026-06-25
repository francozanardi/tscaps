import { useState, type ReactElement } from 'react';
import { ChevronsUp, ChevronsDown, Clock3, Trash2, Palette, Plus, Check, SwatchBook } from 'lucide-react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentStyleOverrides } from '@core/captions/domain/SegmentStyleOverrides';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { POPOVER_MENU_SHAPE, POPOVER_ITEM, POPOVER_ITEM_MOVE, POPOVER_ITEM_DANGER } from '@ui/pages/editor/features/transcript/transcript-classes';
import { PromptDialog } from '@ui/_shared/components/Dialog/PromptDialog';
import { SegmentStyleOverridesPanel } from '@ui/pages/editor/features/transcript/components/segments/SegmentStyleOverridesPanel';
import { SegmentTimeScreen } from '@ui/pages/editor/features/transcript/components/segments/SegmentTimeScreen';

interface SegmentSettingsData {
  doc: Document;
  segment: Segment;
  segIdx: number;
  isFirstSegment: boolean;
  isLastSegment: boolean;
  sheet: Sheet | null;
  sheets: Sheet[];
  currentOverrides: SegmentStyleOverrides;
  /** Lower/upper bounds for the timing screen (immediate neighbors). */
  prevSegmentEnd: number;
  nextSegmentStart: number;
  onDeleteWords: (wordIds: string[]) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onAssignSegmentSheet: (segment: Segment, sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  onCommitStyleOverrides: (overrides: SegmentStyleOverrides) => void;
  onCommitSegmentTime: (start: number, end: number) => void;
  onRedistributeWords: () => void;
}

interface SegmentSettingsBase extends SegmentSettingsData {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SegmentSettingsWithTrigger extends SegmentSettingsBase {
  trigger: ReactElement;
  triggerTooltip?: string;
  point?: never;
}

interface SegmentSettingsWithPoint extends SegmentSettingsBase {
  point: { x: number; y: number };
  trigger?: never;
  triggerTooltip?: never;
}

export type SegmentSettingsPopoverProps = SegmentSettingsWithTrigger | SegmentSettingsWithPoint;

export function SegmentSettingsPopover(props: SegmentSettingsPopoverProps) {
  const screens = {
    menu: <SegmentMenuScreen {...props} />,
    sheetPicker: <SegmentSheetPickerScreen {...props} />,
    styles: <SegmentStylesScreen {...props} />,
    time: <SegmentTimeScreen {...props} />,
  };

  if ('trigger' in props && props.trigger) {
    return (
      <Popover
        open={props.open}
        onOpenChange={props.onOpenChange}
        trigger={props.trigger}
        {...(props.triggerTooltip ? { triggerTooltip: props.triggerTooltip } : {})}
        side="bottom"
        align="end"
        sideOffset={4}
        screens={screens}
        initialScreen="menu"
      />
    );
  }
  return (
    <Popover
      open={props.open}
      onOpenChange={props.onOpenChange}
      point={props.point!}
      screens={screens}
      initialScreen="menu"
    />
  );
}

function SegmentMenuScreen({
  doc, segment, segIdx, isFirstSegment, isLastSegment, sheet,
  onDeleteWords, onApplyStructureEdit,
}: SegmentSettingsData) {
  const { documentEditor } = useEngine();
  const { navigate, close } = usePopoverNav();
  return (
    <div className={POPOVER_MENU_SHAPE}>
      <button className={POPOVER_ITEM} onClick={() => navigate('time')}>
        <Clock3 size={13} /> Edit timing
      </button>
      {sheet && (
        <button className={POPOVER_ITEM} onClick={() => navigate('styles')}>
          <Palette size={13} /> Edit style
        </button>
      )}
      <button className={POPOVER_ITEM} onClick={() => navigate('sheetPicker')}>
        <SwatchBook size={13} /> Change style sheet
      </button>
      {!isFirstSegment && (
        <button className={POPOVER_ITEM} onClick={() => { onApplyStructureEdit(documentEditor.mergeSegmentWithNext(doc, segIdx - 1)); close(); }}>
          <ChevronsUp size={13} /> Join with previous scene
        </button>
      )}
      {!isLastSegment && (
        <button className={POPOVER_ITEM} onClick={() => { onApplyStructureEdit(documentEditor.mergeSegmentWithNext(doc, segIdx)); close(); }}>
          <ChevronsDown size={13} /> Join with next scene
        </button>
      )}
      <button className={POPOVER_ITEM_DANGER} onClick={() => { onDeleteWords(segment.lines.flatMap((l) => l.words.map((w) => w.id))); close(); }}>
        <Trash2 size={13} /> Delete scene
      </button>
    </div>
  );
}

function SegmentSheetPickerScreen({
  segment, sheet, sheets, onAssignSegmentSheet, onCreateSheet,
}: SegmentSettingsData) {
  const { close } = usePopoverNav();
  const [promptOpen, setPromptOpen] = useState(false);

  const handleAssign = (sheetId: string) => {
    if (sheet?.id !== sheetId) onAssignSegmentSheet(segment, sheetId);
    close();
  };

  const handleCreateConfirm = (name: string) => {
    setPromptOpen(false);
    const newId = onCreateSheet(name);
    if (newId) onAssignSegmentSheet(segment, newId);
    close();
  };

  return (
    <div className={POPOVER_MENU_SHAPE}>
      <PopoverHeader title="Style sheet" />
      {sheets.map((s) => {
        const isAssigned = sheet?.id === s.id;
        const isMain = s.color === null;
        return (
          <button
            key={s.id}
            className={POPOVER_ITEM}
            onClick={() => handleAssign(s.id)}
          >
            <span
              className={
                isMain
                  ? 'w-2.5 h-2.5 rounded-full bg-transparent border border-edge-strong shrink-0'
                  : 'w-2.5 h-2.5 rounded-full bg-edge-strong shrink-0'
              }
              style={s.color ? { background: s.color } : undefined}
            />
            <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis">{s.name}</span>
            {isAssigned && <Check size={12} />}
          </button>
        );
      })}
      <button className={POPOVER_ITEM_MOVE} onClick={() => setPromptOpen(true)}>
        <Plus size={13} /> New sheet…
      </button>
      <PromptDialog
        open={promptOpen}
        label="Style sheet name"
        defaultValue="New sheet"
        confirmLabel="Create"
        onConfirm={handleCreateConfirm}
        onCancel={() => setPromptOpen(false)}
      />
    </div>
  );
}

function SegmentStylesScreen({ sheet, currentOverrides, onCommitStyleOverrides }: SegmentSettingsData) {
  if (!sheet) return null;
  return (
    <SegmentStyleOverridesPanel
      sheet={sheet}
      currentOverrides={currentOverrides}
      onCommit={onCommitStyleOverrides}
    />
  );
}

