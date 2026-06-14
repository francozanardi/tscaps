import type { ReactElement } from 'react';
import { ArrowUp, ArrowDown, Link2, Scissors, Trash2 } from 'lucide-react';
import type { Document, Line } from '@tscaps/engine';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { POPOVER_MENU_SHAPE, POPOVER_ITEM, POPOVER_ITEM_MOVE, POPOVER_ITEM_DANGER } from '@ui/pages/editor/features/captions/captions-classes';

interface LineSettingsData {
  doc: Document;
  segIdx: number;
  lineIdx: number;
  line: Line;
  isLastLine: boolean;
  isFirstSegment: boolean;
  isLastSegment: boolean;
  onDeleteWords: (wordIds: string[]) => void;
  onApplyStructureEdit: (doc: Document) => void;
}

export interface LineSettingsPopoverProps extends LineSettingsData {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  triggerTooltip?: string;
}

/**
 * Line-options popover. Single-screen wrapper over `<Popover>`; the actual
 * menu items live in `LineSettingsMenu` so they can use `usePopoverNav` for
 * dismissal after each action.
 */
export function LineSettingsPopover({
  open, onOpenChange, trigger, triggerTooltip, ...data
}: LineSettingsPopoverProps) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      {...(triggerTooltip ? { triggerTooltip } : {})}
      side="bottom"
      align="end"
      sideOffset={4}
      screens={{ menu: <LineSettingsMenu {...data} /> }}
    />
  );
}

function LineSettingsMenu({
  doc, segIdx, lineIdx, line, isLastLine, isFirstSegment, isLastSegment,
  onDeleteWords, onApplyStructureEdit,
}: LineSettingsData) {
  const { documentEditor } = useEngine();
  const { close } = usePopoverNav();
  return (
    <div className={POPOVER_MENU_SHAPE}>
      {lineIdx === 0 && !isFirstSegment && (
        <button className={POPOVER_ITEM_MOVE} onClick={() => { onApplyStructureEdit(documentEditor.moveLineToSegment(doc, segIdx, 0, segIdx - 1, doc.getSegments()[segIdx - 1]!.lines.length)); close(); }}>
          <ArrowUp size={13} /> Move to previous scene
        </button>
      )}
      {!isLastLine && (
        <button className={POPOVER_ITEM_MOVE} onClick={() => { onApplyStructureEdit(documentEditor.splitSegmentAfterLine(doc, segIdx, lineIdx)); close(); }}>
          <Scissors size={13} /> Split scene after this line
        </button>
      )}
      {!isLastLine && (
        <button className={POPOVER_ITEM} onClick={() => { onApplyStructureEdit(documentEditor.mergeLineWithNext(doc, segIdx, lineIdx)); close(); }}>
          <Link2 size={13} /> Join with line below
        </button>
      )}
      {isLastLine && !isLastSegment && (
        <button className={POPOVER_ITEM_MOVE} onClick={() => { onApplyStructureEdit(documentEditor.moveLineToSegment(doc, segIdx, lineIdx, segIdx + 1, 0)); close(); }}>
          <ArrowDown size={13} /> Move to next scene
        </button>
      )}
      <button className={POPOVER_ITEM_DANGER} onClick={() => { onDeleteWords(line.words.map((w) => w.id)); close(); }}>
        <Trash2 size={13} /> Delete line
      </button>
    </div>
  );
}
