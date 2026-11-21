import type { OutputFormat } from '@tscaps/engine';

/**
 * Answers, before a run, which codec a soundtrack mixed into an export
 * of a given format would be written with in this browser — the same
 * choice the render makes once it starts — so a mix that cannot be
 * written is said upfront rather than found out at the end.
 *
 * The answer depends on the browser alone, never on a particular video.
 */
export interface AudioMixEncodeSupport {
  /** The codec's mediabunny name (`aac`, `opus`, …), or null when no codec that format holds can be written here. */
  codecFor(format: OutputFormat): Promise<string | null>;
}
