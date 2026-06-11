import type { Asset } from '@core/templates/domain/Asset';
import type { AssetRepository } from '@core/templates/domain/AssetRepository';

/**
 * Observable view of the assets a repository exposes. Listens to
 * every mutable source that feeds the repository and re-projects on
 * each `'change'` event, then emits its own `'change'`. The snapshot
 * reference is stable between events: two calls without an
 * intervening source change return the same array, suitable for
 * direct equality comparison.
 */
export class AssetsStore extends EventTarget {
  private cachedSnapshot: readonly Asset[];
  private readonly changeEvent = new Event('change');

  constructor(
    private readonly repository: AssetRepository,
    mutableSources: readonly EventTarget[],
  ) {
    super();
    this.cachedSnapshot = repository.list();
    const onSourceChange = () => this.refresh();
    for (const source of mutableSources) {
      source.addEventListener('change', onSourceChange);
    }
  }

  snapshot(): readonly Asset[] {
    return this.cachedSnapshot;
  }

  private refresh(): void {
    this.cachedSnapshot = this.repository.list();
    this.dispatchEvent(this.changeEvent);
  }
}
