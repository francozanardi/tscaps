import type { AssetRepository } from '@core/assets/domain/AssetRepository';

// Matches `asset:<id>` tokens emitted by template CSS (e.g.
// `mask-image: url('asset:marker-stroke')`). The id charset mirrors what
// the repository accepts; anything else stays untouched.
const ASSET_TOKEN_PATTERN = /asset:([a-zA-Z0-9_-]+)/g;

/**
 * Rewrites every `asset:<id>` token in a CSS string to the resolved URL
 * the repository registers for that id. Throws on an unknown id: the
 * intent is to surface authoring or persistence bugs loudly rather than
 * silently render a broken template.
 */
export class CssAssetReferenceResolver {

  constructor(private readonly assetRepository: AssetRepository) {}

  resolve(css: string): string {
    return css.replace(ASSET_TOKEN_PATTERN, (_match, id: string) => {
      const asset = this.assetRepository.resolve(id);
      if (!asset) {
        throw new Error(`Template CSS references unknown asset id: "${id}"`);
      }
      return asset.url;
    });
  }
}
