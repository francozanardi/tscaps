import type { KeymapOverridesRepository } from '@core/shortcuts/domain/KeymapOverridesRepository';
import type { KeymapResolver } from '@core/shortcuts/services/KeymapResolver';
import type { KeymapStore } from '@core/shortcuts/store/KeymapStore';

/** Puts the stored keymap choices in force. */
export class LoadKeymapAction {

  constructor(
    private readonly repository: KeymapOverridesRepository,
    private readonly resolver: KeymapResolver,
    private readonly store: KeymapStore,
  ) {}

  execute(): void {
    const overrides = this.repository.load();
    this.store.set(this.resolver.resolve(overrides), overrides);
  }
}
