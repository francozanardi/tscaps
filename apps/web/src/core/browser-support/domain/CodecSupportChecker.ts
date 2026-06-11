/**
 * Reports whether the current browser can encode video in the output
 * formats the app needs. Implementations may probe specific codecs,
 * container formats, or a combination — the contract is binary: the
 * app either has a usable encoder or it doesn't.
 */
export interface CodecSupportChecker {
  canEncodeMp4(): Promise<boolean>;
}
