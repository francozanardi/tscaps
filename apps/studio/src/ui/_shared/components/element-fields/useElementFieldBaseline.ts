import { useMemo } from 'react';
import type { ElementKind } from '@core/elements/domain/ElementKind';
import type { ElementFieldValues } from '@core/elements/domain/ElementStyles';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { ElementFieldBaselineResolver } from '@presentation/editor/services/ElementFieldBaselineResolver';
import { RestingStyleFieldReader } from '@presentation/editor/services/RestingStyleFieldReader';
import { useRestingElementStyle } from '@ui/_shared/components/element-fields/useRestingElementStyle';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';

const NOTHING: ElementFieldValues = {};

const restingReader = new RestingStyleFieldReader();

/**
 * What each of the element's fields shows while it has been told
 * nothing, keyed by field id.
 *
 * A word answers with what the browser resolves for it at rest, so a
 * rule the template keeps for its tags, the sheet's edits and CSS
 * written by hand all show; any other element, or a word outside an
 * editor, answers from what was configured.
 *
 * `ancestorIds` runs nearest first and must keep its identity across
 * renders that change nothing, since the answer is recomputed whenever
 * it does not.
 */
export function useElementFieldBaseline(
  elementId: string,
  kind: ElementKind,
  sheet: Sheet | null,
  ancestorIds: ReadonlyArray<string>,
): ElementFieldValues {
  const { elementStyles } = useEditorState();
  const { styledElementCatalog } = useElements().services;
  const properties = useMemo(() => restingReader.propertiesFor(styledElementCatalog.fieldsFor('word')), [styledElementCatalog]);
  const resting = useRestingElementStyle(elementId, kind, sheet, properties);

  const resolver = useMemo(
    () => new ElementFieldBaselineResolver(styledElementCatalog, restingReader),
    [styledElementCatalog],
  );

  return useMemo(
    () => (sheet ? resolver.resolve(kind, sheet, ancestorIds.map((id) => elementStyles.get(id)), resting) : NOTHING),
    [resolver, kind, sheet, ancestorIds, elementStyles, resting],
  );
}
