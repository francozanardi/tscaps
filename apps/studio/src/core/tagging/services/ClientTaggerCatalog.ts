import type { TaggerDescriptor } from '@core/tagging/domain/TaggerDescriptor';
import { NumberTaggerDescriptor } from '@core/tagging/services/descriptors/NumberTaggerDescriptor';
import { QuoteTaggerDescriptor } from '@core/tagging/services/descriptors/QuoteTaggerDescriptor';

/**
 * The taggers that read a document and decide for themselves, as
 * opposed to the ones whose tags arrive already attached from a
 * service upstream.
 *
 * A list of its own because two places build a registry: the editor,
 * where the remote taggers are added on top, and a render container
 * assembling a project with no editor around it, where they are not —
 * their `apply` is a passthrough, so a registry without them produces
 * the same document. Kept in one place so a third client tagger
 * reaches both without anybody remembering to add it twice.
 */
export class ClientTaggerCatalog {
  list(): readonly TaggerDescriptor[] {
    return [new NumberTaggerDescriptor(), new QuoteTaggerDescriptor()];
  }
}
