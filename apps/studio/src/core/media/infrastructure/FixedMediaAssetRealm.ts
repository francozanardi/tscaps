import type { MediaAssetRealm } from '@core/media/domain/MediaAssetRealm';

/** `MediaAssetRealm` that never changes: one realm, always the current one, and the only one listed. */
export class FixedMediaAssetRealm implements MediaAssetRealm {
  constructor(private readonly realm: string) {}

  current(): string {
    return this.realm;
  }

  includes(realm: string): boolean {
    return realm === this.realm;
  }
}
