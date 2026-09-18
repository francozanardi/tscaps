import { CssMinifier, CssSelectorClassScanner } from '@tscaps/engine';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TaggerDescriptor } from '@core/tagging/domain/TaggerDescriptor';
import { TaggerRegistry } from '@core/tagging/services/TaggerRegistry';
import { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import { ClientTaggerCatalog } from '@core/tagging/services/ClientTaggerCatalog';
import { StyledTagNameResolver } from '@core/tagging/services/StyledTagNameResolver';

export interface TaggingDependencies {
  readonly store: EditorStore;
}

export type TaggingModule = ReturnType<typeof bootTagging>;

export function bootTagging(deps: TaggingDependencies) {
  const descriptors: TaggerDescriptor[] = [...new ClientTaggerCatalog().list()];


  const registry = new TaggerRegistry(descriptors);
  return {
    registry,
    styledTagNameResolver: new StyledTagNameResolver(new CssMinifier(), new CssSelectorClassScanner()),
    actions: {
      runTaggers: new RunTaggersAction(deps.store, registry),
    },
  };
}

