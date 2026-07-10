/**
 * Time range (in seconds) during which the video's scene meets every
 * criterion the text-behind-actor effect needs. Windows are produced
 * by the detector during preprocessing and consumed by the gating
 * service that decides which segments the effect applies to.
 */
export interface PersonSegmentationWindow {
  readonly start: number;
  readonly end: number;
}
