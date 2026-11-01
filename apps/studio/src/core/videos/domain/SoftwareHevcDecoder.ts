/**
 * Lets this page's mediabunny decode HEVC in software, without the
 * browser's own decoder.
 *
 * Once `install` resolves, mediabunny reports HEVC Main and Main 10
 * tracks as decodable and decodes them through it, for the rest of the
 * page's life, including tracks the browser could decode itself,
 * since a decoder registered with mediabunny takes precedence over
 * WebCodecs. Idempotent: later calls resolve with the first install.
 * Rejects when the decoder cannot be loaded, and a later call then
 * tries again.
 */
export interface SoftwareHevcDecoder {
  install(): Promise<void>;
}
