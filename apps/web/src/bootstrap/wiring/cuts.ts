import type { EditorStore } from '@core/editor/store/EditorStore';
import { AddCutAction } from '@core/cuts/actions/AddCutAction';
import { RestoreCutsRangeAction } from '@core/cuts/actions/RestoreCutsRangeAction';
import { ResizeCutAction } from '@core/cuts/actions/ResizeCutAction';
import { ClearAllCutsAction } from '@core/cuts/actions/ClearAllCutsAction';
import { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { RenderTimeMapBuilder } from '@core/cuts/services/RenderTimeMapBuilder';

export interface CutsDependencies {
  readonly store: EditorStore;
}

export type CutsModule = ReturnType<typeof bootCuts>;

/**
 * Boots the cuts feature: the actions that mutate the editor store's
 * cut registry, plus the document builder that projects the registry
 * onto a Document so downstream surfaces (preview, export, navigation)
 * see only the words that survive the cuts.
 */
export function bootCuts(deps: CutsDependencies) {
  return {
    actions: {
      add: new AddCutAction(deps.store),
      resize: new ResizeCutAction(deps.store),
      restoreRange: new RestoreCutsRangeAction(deps.store),
      clearAll: new ClearAllCutsAction(deps.store),
    },
    services: {
      cutAwareDocumentBuilder: new CutAwareDocumentBuilder(),
      renderTimeMapBuilder: new RenderTimeMapBuilder(),
    },
  };
}
