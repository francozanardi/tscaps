import type { BuiltinAssetRepository } from '@core/templates/infrastructure/repositories/BuiltinAssetRepository';
import { BuiltinAssetRepositoryBuilder } from '@core/templates/infrastructure/BuiltinAssetRepositoryBuilder';

// Vite scans the repo-root `templates/_assets/` directory at build time
// and emits a content-hashed URL per file. Dropping a new asset into
// that folder makes it available to every template via its filename id.
const assetModules = import.meta.glob('../../../../../../templates/_assets/*.{png,svg,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export const BUILTIN_ASSET_REPOSITORY: BuiltinAssetRepository = new BuiltinAssetRepositoryBuilder(assetModules).build();
