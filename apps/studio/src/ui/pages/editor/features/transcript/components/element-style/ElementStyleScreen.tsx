import { RotateCcw } from 'lucide-react';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { ElementFieldList } from '@ui/_shared/components/element-fields/ElementFieldList';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { ElementPositionRow } from '@ui/_shared/components/element-fields/ElementPositionRow';
import { useElementPositionBaseline } from '@ui/_shared/components/element-fields/useElementPositionBaseline';

interface ElementStyleScreenProps {
  title: string;
  elementId: string;
  kind: ElementKind;
  /** The sheet whose rules the element renders under, which is what its fields fall back to. */
  sheet: Sheet;
  /** The elements it sits inside, nearest first. Must keep its identity across renders that change nothing. */
  ancestorIds: ReadonlyArray<string>;
}

const ICON_BTN =
  'flex items-center justify-center w-5 h-5 rounded-xs border-none bg-transparent text-fg-faint cursor-pointer ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:text-fg-secondary hover:bg-surface-3 ' +
  'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-secondary';

/**
 * The "Edit style" screen of an element's popover: what it looks like,
 * and where it sits.
 *
 * The fields are the same ones the sidebar offers, so an element cannot
 * be told two different things about itself depending on which surface
 * the user reached for. Position stays beside them rather than joining
 * them, because it never becomes a declaration — the element leaves the
 * flow it was laid out in and is anchored in the frame, which is a
 * different kind of answer from a colour.
 *
 * Resetting takes back everything: the fields, the entrance, the CSS
 * beside them, and the placement.
 */
export function ElementStyleScreen({
  title,
  elementId,
  kind,
  sheet,
  ancestorIds,
}: ElementStyleScreenProps) {
  const elements = useElements();
  const { elementStyles } = useEditorState();

  const positionBaseline = useElementPositionBaseline(kind, elementId, sheet, ancestorIds);
  const placement = elementStyles.placementOf(elementId);

  const resetButton = elements.actions.reset.holdsAnything(elementId) ? (
    <button
      type="button"
      className={ICON_BTN}
      title="Reset this element"
      aria-label="Reset this element"
      onClick={() => elements.actions.reset.execute(elementId)}
    >
      <RotateCcw size={11} />
    </button>
  ) : undefined;

  return (
    <div className="p-2 flex flex-col gap-2 w-[240px] box-border">
      <PopoverHeader title={title} action={resetButton} />
      <ElementFieldList
        elementId={elementId}
        kind={kind}
        sheet={sheet}
        ancestorIds={ancestorIds}
        compact
      />
      {elements.services.styledElementCatalog.canBePlaced(kind) && (
        <ElementPositionRow
          current={placement}
          baseline={positionBaseline}
          compact
          onCommit={(next) => {
            if (next) elements.actions.setPlacement.execute(elementId, kind, next);
            else elements.actions.setPlacement.clear(elementId, kind);
          }}
        />
      )}
    </div>
  );
}
