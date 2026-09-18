import { Fragment, memo, useCallback, useMemo } from 'react';
import type { AuthoredElementControl } from '@core/elements/domain/ElementControl';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import { ElementFieldSection } from '@core/elements/domain/fields/ElementFieldSection';
import type { ElementControlValue } from '@core/elements/services/css/ElementControlCssWriter';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { Section } from '@ui/_shared/components/controls/sections/Section';
import { ElementFieldSectionView } from '@ui/_shared/components/element-fields/ElementFieldSectionView';
import { useElementFieldBaseline } from '@ui/_shared/components/element-fields/useElementFieldBaseline';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { useElementScripts } from '@ui/_shared/hooks/useElementScripts';

interface ElementFieldListProps {
  elementId: string;
  kind: ElementKind;
  /** The sheet whose rules the element renders under, which is what its fields fall back to. */
  sheet: Sheet | null;
  /** The elements it sits inside, nearest first. Must keep its identity across renders that change nothing. */
  ancestorIds: ReadonlyArray<string>;
  /** Narrower labels and no headings, for a popover rather than a sidebar. */
  compact?: boolean | undefined;
  /** Overrides the single-element write while preserving this element's resolved baseline. */
  onChange?: ((control: AuthoredElementControl, value: ElementControlValue) => void) | undefined;
}

const SECTION_TITLES: Readonly<Record<ElementFieldSection, string>> = {
  [ElementFieldSection.TEXT]: 'Text',
  [ElementFieldSection.LAYOUT]: 'Layout',
};

/**
 * Every field one element offers, grouped the way the fields say they
 * belong together, over the values the element records for them.
 *
 * Each field shows what it was last set to, or what it arrives at from
 * further out when it was never set. A field whose declaration has
 * since been edited by hand says so and stops offering to change it:
 * the CSS decides, and a dial that pretended otherwise would put a
 * number on screen that nothing renders.
 *
 * One list wherever an element is styled, so the sidebar and a popover
 * cannot end up offering the same element two different sets of fields.
 * A popover drops the headings: at that width the groups read as one
 * short list, and a heading per group would be most of it.
 */
export const ElementFieldList = memo(function ElementFieldList({
  elementId,
  kind,
  sheet,
  ancestorIds,
  compact,
  onChange,
}: ElementFieldListProps) {
  const elements = useElements();
  const { styledElementCatalog, cssControlledFieldFinder } = elements.services;
  const { elementStyles } = useEditorState();

  const style = elementStyles.get(elementId);
  const baseline = useElementFieldBaseline(kind, sheet, ancestorIds);

  const sections = useMemo(() => styledElementCatalog.sectionsFor(kind), [styledElementCatalog, kind]);
  const controls = useMemo(() => sections.flatMap((entry) => entry.controls), [sections]);
  const takenByCss = useMemo(
    () => cssControlledFieldFinder.find(style, controls),
    [cssControlledFieldFinder, style, controls],
  );
  const shown = useMemo<Readonly<Record<string, ElementControlValue | undefined>>>(
    () => Object.fromEntries(controls.map((control) => [
      control.id,
      style?.fields?.[control.id] ?? baseline[control.id],
    ])),
    [controls, style, baseline],
  );

  const scripts = useElementScripts(elementId, sheet);

  const handleChange = useCallback((control: AuthoredElementControl, next: ElementControlValue) => {
    if (onChange) onChange(control, next);
    else elements.actions.setField.execute(elementId, kind, control, next);
  }, [elements, elementId, kind, onChange]);

  return (
    <>
      {sections.map((entry) => {
        const rows = (
          <ElementFieldSectionView
            controls={entry.controls}
            shown={shown}
            takenByCss={takenByCss}
            compact={compact}
            onChange={handleChange}
            scripts={scripts}
          />
        );
        return compact
          ? <Fragment key={entry.section}>{rows}</Fragment>
          : <Section key={entry.section} title={SECTION_TITLES[entry.section]}>{rows}</Section>;
      })}
    </>
  );
});
