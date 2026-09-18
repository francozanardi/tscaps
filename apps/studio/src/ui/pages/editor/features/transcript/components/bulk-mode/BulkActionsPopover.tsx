import { forwardRef, useState } from 'react';
import { ListChecks, Palette, SwatchBook, Tags, Trash2, UserRound, UserRoundX } from 'lucide-react';
import type { Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';
import { WordTagsPanel } from '@ui/pages/editor/features/transcript/components/words/WordTagsPanel';
import { useWordTagRows, type WordTagRow } from '@ui/pages/editor/features/transcript/components/words/useWordTagRows';
import { BulkElementStyleScreen } from '@ui/pages/editor/features/transcript/components/bulk-mode/BulkElementStyleScreen';
import { TranscriptSheetPickerScreen } from '@ui/pages/editor/features/transcript/components/segments/TranscriptSheetPickerScreen';

export interface BulkStyleContext {
  representativeId: string;
  kind: ElementKind;
  sheet: Sheet;
  ancestorIds: ReadonlyArray<string>;
}

interface BulkActionsPopoverProps {
  target: 'scenes' | 'words';
  segments: ReadonlyArray<Segment>;
  words: ReadonlyArray<Word>;
  sheets: ReadonlyArray<Sheet>;
  assignedSheetId: string | null;
  styleContext: BulkStyleContext | null;
  canUseBehindActor: boolean;
  onEditWordTag: (tagName: string, enabled: boolean) => void;
  onSetBehindActor: (enabled: boolean) => void;
  onAssignSheet: (sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  onEditStyle: (control: AuthoredElementControl, value: ElementControlValue) => void;
  onDelete: () => void;
}

const PRIMARY_BUTTON =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-xs text-xs font-medium border-none cursor-pointer ' +
  'bg-accent text-white transition-colors duration-quick ease-standard ' +
  'hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';
const MENU = 'p-2 flex flex-col gap-1 w-[230px] box-border';
const ITEM_BASE =
  'flex items-center gap-2 w-full text-left text-2xs px-2 py-[7px] rounded-xs border-none bg-transparent';
const ITEM =
  `${ITEM_BASE} cursor-pointer ` +
  'text-fg-secondary hover:bg-surface-3 hover:text-fg-primary focus-visible:outline-none focus-visible:bg-surface-3';
const DANGER_ITEM = `${ITEM} text-danger/80 hover:text-danger hover:bg-danger/10`;
const DISABLED_ITEM = `${ITEM_BASE} text-fg-faint cursor-not-allowed`;

const NO_TAGS_TOOLTIP =
  "This template doesn't use tags, so tagging a word would change nothing on screen. Try another template.";

/** Actions whose meaning remains well-defined over every item in the current selection. */
export function BulkActionsPopover(props: BulkActionsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const count = props.target === 'scenes' ? props.segments.length : props.words.length;
  const tagRows = useWordTagRows(props.words, props.styleContext?.sheet ?? null);
  return (
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={<TriggerButton disabled={count === 0} />}
        screens={{
          menu: <Menu {...props} tagRows={tagRows} onAskDelete={() => setConfirmDelete(true)} />,
          tags: <WordTagsPanel rows={tagRows} onToggle={props.onEditWordTag} />,
          sheets: (
            <TranscriptSheetPickerScreen
              sheets={props.sheets}
              assignedSheetId={props.assignedSheetId}
              onAssign={props.onAssignSheet}
              onCreateSheet={props.onCreateSheet}
            />
          ),
          style: props.styleContext ? (
            <BulkElementStyleScreen {...props.styleContext} onChange={props.onEditStyle} />
          ) : null,
        }}
        initialScreen="menu"
        side="top"
        align="end"
      />
      <ConfirmDialog
        open={confirmDelete}
        message={`This will delete ${count} selected ${props.target}.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => { setConfirmDelete(false); setOpen(false); props.onDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

const TriggerButton = forwardRef<HTMLButtonElement, { disabled?: boolean }>(
  function TriggerButton({ disabled, ...props }, ref) {
    return (
      <button {...props} ref={ref} type="button" disabled={disabled} className={PRIMARY_BUTTON}>
        <ListChecks size={14} /> Actions
      </button>
    );
  },
);

function Menu(props: BulkActionsPopoverProps & { tagRows: ReadonlyArray<WordTagRow>; onAskDelete: () => void }) {
  const { navigate, close } = usePopoverNav();
  if (props.target === 'words') {
    return (
      <div className={MENU}>
        <PopoverHeader title="Selected words" />
        {props.styleContext && <button type="button" className={ITEM} onClick={() => navigate('style')}><Palette size={13} /> Edit style</button>}
        {props.tagRows.length > 0 ? (
          <button type="button" className={ITEM} onClick={() => navigate('tags')}><Tags size={13} /> Edit tags</button>
        ) : (
          <Tooltip text={NO_TAGS_TOOLTIP} position="left">
            <div>
              <button type="button" className={DISABLED_ITEM} disabled><Tags size={13} /> Edit tags</button>
            </div>
          </Tooltip>
        )}
        <button type="button" className={DANGER_ITEM} onClick={() => { close(); props.onAskDelete(); }}><Trash2 size={13} /> Delete words</button>
      </div>
    );
  }
  return (
    <div className={MENU}>
      <PopoverHeader title="Selected scenes" />
      {props.styleContext && <button type="button" className={ITEM} onClick={() => navigate('style')}><Palette size={13} /> Edit style</button>}
      {props.canUseBehindActor && (
        <>
          <button type="button" className={ITEM} onClick={() => { props.onSetBehindActor(true); close(); }}><UserRound size={13} /> Place behind person</button>
          <button type="button" className={ITEM} onClick={() => { props.onSetBehindActor(false); close(); }}><UserRoundX size={13} /> Keep in front</button>
        </>
      )}
      <button type="button" className={ITEM} onClick={() => navigate('sheets')}><SwatchBook size={13} /> Change style sheet</button>
      <button type="button" className={DANGER_ITEM} onClick={() => { close(); props.onAskDelete(); }}><Trash2 size={13} /> Delete scenes</button>
    </div>
  );
}
