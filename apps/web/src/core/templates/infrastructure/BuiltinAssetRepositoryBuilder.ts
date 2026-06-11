import type { Asset } from '@core/templates/domain/Asset';
import { BuiltinAssetRepository } from '@core/templates/infrastructure/repositories/BuiltinAssetRepository';

/**
 * Assembles the built-in `BuiltinAssetRepository` from the raw module
 * map produced by Vite's `import.meta.glob` over `templates/_assets/`.
 * Each file becomes one `Asset` whose id is its filename without
 * extension and whose url is the build-time emitted URL.
 */
export class BuiltinAssetRepositoryBuilder {

  constructor(private readonly assetModules: Record<string, string>) {}

  build(): BuiltinAssetRepository {
    return new BuiltinAssetRepository(this.entries());
  }

  private entries(): Asset[] {
    return Object.entries(this.assetModules).map(([path, url]) => ({
      id: this.idFromPath(path),
      url,
      source: 'builtin',
    }));
  }

  // `.../templates/_assets/marker-stroke.png` → `marker-stroke`
  private idFromPath(path: string): string {
    const file = path.split('/').pop();
    if (file === undefined || file === '') {
      throw new Error(`Unexpected asset path: "${path}"`);
    }
    const dot = file.lastIndexOf('.');
    return dot < 0 ? file : file.slice(0, dot);
  }
}
