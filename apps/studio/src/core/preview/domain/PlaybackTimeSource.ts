/** Where playback stands on the output timeline, read live, and whether it is moving. */
export interface PlaybackTimeSource {
  isRunning(): boolean;
  currentOutputTimeSec(): number;
}
