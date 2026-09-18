import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { ElementFieldList } from '@ui/_shared/components/element-fields/ElementFieldList';

interface BulkElementStyleScreenProps {
  representativeId: string;
  kind: ElementKind;
  sheet: Sheet;
  ancestorIds: ReadonlyArray<string>;
  onChange: (control: AuthoredElementControl, value: ElementControlValue) => void;
}

/** Style fields for a selection; the displayed baseline is representative and only changed fields fan out. */
export function BulkElementStyleScreen({
  representativeId,
  kind,
  sheet,
  ancestorIds,
  onChange,
}: BulkElementStyleScreenProps) {
  return (
    <div className="p-2 flex flex-col gap-2 w-[240px] box-border">
      <PopoverHeader title="Style selection" />
      <p className="m-0 text-2xs text-fg-faint leading-snug">
        Values reflect the first selected item. Only fields you change are applied to the selection.
      </p>
      <ElementFieldList
        elementId={representativeId}
        kind={kind}
        sheet={sheet}
        ancestorIds={ancestorIds}
        compact
        onChange={onChange}
      />
    </div>
  );
}
