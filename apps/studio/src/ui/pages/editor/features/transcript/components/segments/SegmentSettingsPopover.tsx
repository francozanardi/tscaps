import { useEffect, useState, type ReactElement } from 'react';
import { ChevronsUp, ChevronsDown, Clock3, Trash2, Palette, Plus, Check, SwatchBook, UserRound, RotateCcw, Loader2 } from 'lucide-react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentStyleOverrides } from '@core/captions/domain/SegmentStyleOverrides';
import type { BehindActorSegmentOverride } from '@core/person-segmentation/domain/BehindActorSegmentOverride';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';
import { useSegmentMaskBackfillPending } from '@ui/pages/editor/features/person-segmentation/hooks/useSegmentMaskBackfillPending';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';
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
  behindActorOverride: BehindActorSegmentOverride;
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
  doc, segment, segIdx, isFirstSegment, isLastSegment, sheet, behindActorOverride,
  onDeleteWords, onApplyStructureEdit,
}: SegmentSettingsData) {
  const { documentEditor } = useEngine();
  const { navigate, close } = usePopoverNav();
  const captions = useCaptions();
  const personSegmentation = usePersonSegmentation();
  const detectorResult = useLoadedDetectorResult(personSegmentation.loadedCacheStore);
  const isComputingMasks = useSegmentMaskBackfillPending(segment.id);

  const showBehindActor = sheet !== null
    && sheet.template.features.behindActorOverride
    && personSegmentation.previewSupportChecker.isSupported();
  const validWindows = detectorResult?.windows ?? [];
  const behindActorOn = showBehindActor
    && personSegmentation.gatingService.isEffectivelyOn(segment, behindActorOverride, validWindows);

  const handleToggleBehindActor = () => {
    const next: BehindActorSegmentOverride = behindActorOn ? 'force-off' : 'force-on';
    captions.actions.segments.setBehindActorOverride.execute(segment.id, next);
    if (next === 'force-on') {
      personSegmentation.actions.ensureSegmentMasks
        .execute({ segmentId: segment.id, range: { start: segment.time.start, end: segment.time.end } })
        .catch((error) => console.error('[behind-actor] segment mask backfill failed', error));
    }
    close();
  };

  const handleResetBehindActorToAuto = () => {
    captions.actions.segments.setBehindActorOverride.execute(segment.id, 'auto');
    close();
  };

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
      {showBehindActor && (
        <button className={POPOVER_ITEM} onClick={handleToggleBehindActor} disabled={isComputingMasks}>
          {isComputingMasks ? <Loader2 size={13} className="animate-spin" /> : <UserRound size={13} />}
          <span className="flex-1 text-left">Hide behind person</span>
          {behindActorOn && <Check size={12} />}
        </button>
      )}
      {showBehindActor && behindActorOverride !== 'auto' && (
        <button className={POPOVER_ITEM} onClick={handleResetBehindActorToAuto}>
          <RotateCcw size={13} /> Reset to auto
        </button>
      )}
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

function useLoadedDetectorResult(store: LoadedPersonSegmentationCacheStore): PersonSegmentationResult | null {
  const [result, setResult] = useState<PersonSegmentationResult | null>(() => store.current?.result ?? null);
  useEffect(() => {
    const update = (): void => setResult(store.current?.result ?? null);
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [store]);
  return result;
}

