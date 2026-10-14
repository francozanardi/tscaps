import type { KeymapOverrides } from '@core/shortcuts/domain/KeymapOverrides';
import type { KeymapOverridesRepository } from '@core/shortcuts/domain/KeymapOverridesRepository';
import type { KeymapResolver } from '@core/shortcuts/services/KeymapResolver';
import type { KeymapStore } from '@core/shortcuts/store/KeymapStore';

/** Keeps a new set of keymap choices and puts it in force at once. */
export class SaveKeymapOverridesAction {

  constructor(
    private readonly repository: KeymapOverridesRepository,
    private readonly resolver: KeymapResolver,
    private readonly store: KeymapStore,
  ) {}

  execute(overrides: KeymapOverrides): void {
    this.repository.save(overrides);
    this.store.set(this.resolver.resolve(overrides), overrides);
  }
}
