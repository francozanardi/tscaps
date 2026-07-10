import type { EditorStore } from '@core/editor/store/EditorStore';
import type { TaggerDescriptor } from '@core/tagging/domain/TaggerDescriptor';
import { TaggerRegistry } from '@core/tagging/services/TaggerRegistry';
import { RunTaggersAction } from '@core/tagging/actions/RunTaggersAction';
import { NumberTaggerDescriptor } from '@core/tagging/services/descriptors/NumberTaggerDescriptor';
import { QuoteTaggerDescriptor } from '@core/tagging/services/descriptors/QuoteTaggerDescriptor';

export interface TaggingDependencies {
  readonly store: EditorStore;
}

export type TaggingModule = ReturnType<typeof bootTagging>;

export function bootTagging(deps: TaggingDependencies) {
  const descriptors: TaggerDescriptor[] = [
    new NumberTaggerDescriptor(),
    new QuoteTaggerDescriptor(),
  ];


  const registry = new TaggerRegistry(descriptors);
  return {
    registry,
    actions: {
      runTaggers: new RunTaggersAction(deps.store, registry),
    },
  };
}

