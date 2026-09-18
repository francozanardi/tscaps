import { FontStack } from '@core/fonts/domain/FontStack';
import type { FontStackFaces } from '@core/fonts/domain/FontStackCatalog';
import { TYPOGRAPHY_DEFAULTS, type TypographyConfig } from '@core/sheets/domain/TypographyConfig';

/**
 * Typography as it is stored: primitives, plus the stack spelled out
 * face by face. Declared apart from {@link TypographyConfig} so a raw
 * payload cannot pass for the live shape, which holds an object with
 * methods.
 *
 * The faces are written out rather than stored as the id of the catalog
 * stack they came from: the reader tunes them one at a time, and a tuned
 * stack answers to no id.
 */
export type SerializedTypographyConfig =
  Omit<TypographyConfig, 'fontStack'>
  & { readonly fontStack: FontStackFaces };

/** Reads and writes the typography of anything that persists one: a project's sheets, a saved template. */
export class TypographyConfigSerializer {

  serialize(config: TypographyConfig): SerializedTypographyConfig {
    return { ...config, fontStack: config.fontStack.toSnapshot() };
  }

  /**
   * Typography as the app holds it, layered over the defaults: a payload
   * written before a field existed would otherwise leave `undefined`
   * behind a non-optional type.
   */
  deserialize(stored: Partial<SerializedTypographyConfig> | undefined): TypographyConfig {
    return {
      ...TYPOGRAPHY_DEFAULTS,
      ...stored,
      fontStack: FontStack.fromSnapshot(stored?.fontStack, TYPOGRAPHY_DEFAULTS.fontStack),
    };
  }
}
