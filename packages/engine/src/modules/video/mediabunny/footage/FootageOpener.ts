import type { FootageLayer } from '@modules/video/FootageLayer';
import type { OpenedFootage } from '@modules/video/mediabunny/footage/OpenedFootage';

/**
 * Opens a layer's footage for reading. Rejects when the footage cannot
 * be read at all, since its stretch would otherwise show the wrong
 * picture.
 */
export interface FootageOpener {
  open(layer: FootageLayer): Promise<OpenedFootage>;
}
