/**
 * A subtitle file the user brought instead of having the audio
 * transcribed: its name as they picked it, and its text.
 */
export interface SubtitleFile {
  readonly name: string;
  readonly text: string;
}
