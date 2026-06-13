/**
 * Snapshot of the container-level facts about an uploaded media file.
 * Every field is independently nullable because a probe may succeed
 * partially — readable header but no audio track, decoder unable to
 * report codec, etc. Consumers must treat each `null` as "unknown",
 * not as "absent".
 */
export interface VideoSourceMetadata {
  readonly mimeType: string | null;
  readonly containerFormat: string | null;
  readonly durationSeconds: number | null;
  readonly videoCodec: string | null;
  readonly audioCodec: string | null;
  readonly audioSampleRate: number | null;
  readonly audioChannels: number | null;
}
