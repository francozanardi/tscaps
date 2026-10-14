import { useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Document } from '@tscaps/engine';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { InspectedElementHeader } from '@ui/pages/editor/features/element/InspectedElementHeader';
import { ElementMotionPanel } from '@ui/pages/editor/features/element/ElementMotionPanel';
import { ElementStylePanel } from '@ui/pages/editor/features/element/ElementStylePanel';
import { ElementPositionPanel } from '@ui/pages/editor/features/element/ElementPositionPanel';
import { ElementInspectorTabs } from '@ui/pages/editor/features/element/ElementInspectorTabs';
import { ElementEffectsPanel } from '@ui/pages/editor/features/element/ElementEffectsPanel';
import { ElementCodePanel } from '@ui/pages/editor/features/element/ElementCodePanel';
import { useInspectedElement } from '@ui/pages/editor/features/element/useInspectedElement';
import { useSceneReplay } from '@ui/pages/editor/hooks/useSceneReplay';
import { useIsElementInspectorOpen } from '@ui/pages/editor/hooks/useIsElementInspectorOpen';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';
import { useElements } from '@ui/_shared/contexts/modules/ElementsContext';
import { useEditorState } from '@ui/_shared/hooks/useEditorState';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';

interface ElementInspectorProps {
  document: Document | null;
  selectionController: OverlaySelectionController;
}

const HEADER_CLASS =
  'shrink-0 flex items-center gap-2 p-2 bg-surface-1 border border-edge-subtle rounded-md';

const CARD_CLASS =
  'flex flex-col flex-1 min-h-0 bg-surface-1 border border-edge-medium rounded-lg shadow-sm overflow-hidden';

const BACK_BUTTON_CLASS =
  'shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-xs bg-transparent border-none '
  + 'text-fg-muted cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-fg-primary hover:bg-surface-2 '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

/**
 * Everything that can be said about the element picked in the preview:
 * how it looks, how it moves, and the CSS the first two are a view of.
 *
 * It stands in front of the whole workspace pane rather than beside its
 * modes. The elements it edits are not a part of the project the way
 * captions are — they are whatever the user just pointed at, an emoji
 * today, a GIF or a widget later — so it is opened from the pick and
 * left through the same door, and the mode underneath is exactly where
 * it was.
 *
 * Renders as two siblings, the header and the card, so it occupies the
 * pane's own rows and needs no surface of its own.
 *
 * It is open only while the element is painted, so the state it draws
 * for a missing one covers the narrow case of a scene outliving what
 * was picked inside it: an edit took the element out and the pick still
 * stands.
 */
export function ElementInspector({ document, selectionController }: ElementInspectorProps) {
  const workspaceStore = useEditorWorkspaceStore();
  const isOpen = useIsElementInspectorOpen();
  const element = useInspectedElement(selectionController, document);
  const { elementStyles, sheets } = useEditorState();
  const replayWithinScene = useSceneReplay(element?.sceneEndsAt ?? 0);

  const sheet = useMemo(
    () => sheets.find((candidate) => candidate.id === element?.sheetId) ?? null,
    [sheets, element?.sheetId],
  );
  const elements = useElements();
  const elementId = element?.id ?? null;
  const clearStyle = useCallback(() => {
    if (elementId !== null) elements.actions.clearStyle.execute(elementId);
  }, [elements, elementId]);
  const close = useCallback(() => workspaceStore.setInspectorOpen(false), [workspaceStore]);

  if (!isOpen) return null;

  return (
    <>
      <div className={HEADER_CLASS}>
        <Tooltip text="Back to the panel">
          <button type="button" onClick={close} aria-label="Back to the panel" className={BACK_BUTTON_CLASS}>
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
        </Tooltip>
        {element ? (
          <InspectedElementHeader
            element={element}
            hasStyle={elementStyles.has(element.id)}
            onClearStyle={clearStyle}
          />
        ) : (
          <span className="text-sm text-fg-muted truncate">Nothing to edit</span>
        )}
      </div>

      <div className={CARD_CLASS}>
        {element ? (
          <ElementInspectorTabs
            style={(
              <>
                <ElementStylePanel
                  elementId={element.id}
                  kind={element.kind}
                  sheet={sheet}
                  ancestorIds={element.ancestorIds}
                />
                {sheet && (
                  <ElementPositionPanel
                    elementId={element.id}
                    kind={element.kind}
                    sheet={sheet}
                    ancestorIds={element.ancestorIds}
                  />
                )}
              </>
            )}
            motion={(
              <ElementMotionPanel
                elementId={element.id}
                kind={element.kind}
                animationSupport={sheet?.template.features.animation ?? null}
                style={elementStyles.get(element.id)}
                startsAt={element.startsAt}
                endsAt={element.endsAt}
                onReplay={replayWithinScene}
              />
            )}
            effects={(
              <ElementEffectsPanel
                elementId={element.id}
                kind={element.kind}
                ancestorIds={element.ancestorIds}
                scene={element.scene}
                sheet={sheet}
              />
            )}
            code={(
              <ElementCodePanel
                elementId={element.id}
                kind={element.kind}
                fragment={elementStyles.get(element.id)}
              />
            )}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="m-0 text-md text-fg-secondary">This element is gone.</p>
            <p className="m-0 text-sm text-fg-muted max-w-[32ch]">
              An edit took it out of the video. Pick another one in the preview.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
