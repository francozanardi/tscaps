/**
 * Per-run knobs the detector accepts. Callers set them from system
 * defaults; the values here follow the eval harness's tuned choices
 * so a default-constructed run reproduces the harness's behaviour.
 */
export interface PersonSegmentationOptions {
  /** Frames per second the pose scan samples the video at. */
  readonly sampleFps: number;
  /** Frames per second the mask cache captures inside valid windows. */
  readonly cacheFps: number;
  /** Width of the downscaled grayscale used for motion / blur measurement. */
  readonly downscaleWidth: number;
  /** Height of the downscaled grayscale used for motion / blur measurement. */
  readonly downscaleHeight: number;
  /** Max side (px) each cached mask is downsampled to before storage. */
  readonly maskMaxSide: number;
}

export const DEFAULT_PERSON_SEGMENTATION_OPTIONS: PersonSegmentationOptions = {
  sampleFps: 6,
  cacheFps: 20,
  downscaleWidth: 160,
  downscaleHeight: 90,
  maskMaxSide: 256,
};
