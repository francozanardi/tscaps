/**
 * Snapshot of the container-level facts about an uploaded media file.
 * Every field is independently nullable because a probe may succeed
 * partially — readable header but no audio track, decoder unable to
 * report codec, etc. Consumers must treat each `null` as "unknown",
 * not as "absent".
 */
export interface VideoSourceMetadata {
  readonly mimeType: string | null;
  /**
   * `false` means the file's bytes could not be read at all — the
   * runtime refused the read itself, so nothing downstream can work
   * from this source. It separates "we cannot get the bytes" from
   * "we got the bytes and did not understand them", which look
   * identical in every other field and call for opposite remedies.
   */
  readonly sourceReadable: boolean;
  readonly containerFormat: string | null;
  readonly durationSeconds: number | null;
  readonly videoCodec: string | null;
  readonly videoWidthPx: number | null;
  readonly videoHeightPx: number | null;
  /**
   * `false` means the container was read and holds no audio track —
   * a positive fact, unlike the `null`-as-unknown convention of the
   * other fields. `null` still means the probe could not tell.
   */
  readonly hasAudioTrack: boolean | null;
  readonly audioCodec: string | null;
  readonly audioSampleRate: number | null;
  readonly audioChannels: number | null;
}
