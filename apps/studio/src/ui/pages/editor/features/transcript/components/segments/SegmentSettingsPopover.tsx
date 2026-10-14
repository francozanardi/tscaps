import type { ReactElement } from 'react';
import { ChevronsUp, ChevronsDown, Clock3, Eye, EyeOff, Trash2, Palette, SwatchBook } from 'lucide-react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { POPOVER_MENU_SHAPE, POPOVER_ITEM, POPOVER_ITEM_DANGER } from '@ui/pages/editor/features/transcript/transcript-classes';
import { SegmentStyleScreen } from '@ui/pages/editor/features/transcript/components/element-style/SegmentStyleScreen';
import { SegmentTimeScreen } from '@ui/pages/editor/features/transcript/components/segments/SegmentTimeScreen';
import { TranscriptSheetPickerScreen } from '@ui/pages/editor/features/transcript/components/segments/TranscriptSheetPickerScreen';

interface SegmentSettingsData {
  doc: Document;
  segment: Segment;
  segIdx: number;
  isFirstSegment: boolean;
  isLastSegment: boolean;
  sheet: Sheet | null;
  sheets: Sheet[];
  /** Lower/upper bounds for the timing screen (immediate neighbors). */
  prevSegmentEnd: number;
  nextSegmentStart: number;
  onDeleteWords: (wordIds: string[]) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onAssignSegmentSheet: (segment: Segment, sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  onCommitSegmentTime: (start: number, end: number) => void;
  onRedistributeWords: () => void;
  onSetHidden: (hidden: boolean) => void;
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
    sheetPicker: (
      <TranscriptSheetPickerScreen
        sheets={props.sheets}
        assignedSheetId={props.sheet?.id ?? null}
        onAssign={(sheetId) => props.onAssignSegmentSheet(props.segment, sheetId)}
        onCreateSheet={props.onCreateSheet}
      />
    ),
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
  onDeleteWords, onApplyStructureEdit, onSetHidden,
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
      <button className={POPOVER_ITEM} onClick={() => { onSetHidden(!segment.hidden); close(); }}>
        {segment.hidden ? <><Eye size={13} /> Show in video</> : <><EyeOff size={13} /> Hide from video</>}
      </button>
      <button className={POPOVER_ITEM_DANGER} onClick={() => { onDeleteWords(segment.lines.flatMap((l) => l.words.map((w) => w.id))); close(); }}>
        <Trash2 size={13} /> Delete scene
      </button>
    </div>
  );
}

function SegmentStylesScreen({ sheet, segment }: SegmentSettingsData) {
  if (!sheet) return null;
  return (
    <SegmentStyleScreen
      sheet={sheet}
      segmentId={segment.id}
    />
  );
}
