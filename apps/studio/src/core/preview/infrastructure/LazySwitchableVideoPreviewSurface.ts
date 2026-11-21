import type { PreviewAudioMix } from '@core/preview/domain/PreviewAudioMix';
import type { PreviewFootage } from '@core/preview/domain/PreviewFootage';
import type { PreviewShownPicture } from '@core/preview/domain/PreviewShownPicture';
import type {
  PreviewSurfaceVariant,
  SwitchableVideoPreviewSurface,
  VideoPreviewSurface,
  VideoPreviewSurfaceSnapshot,
} from '@core/preview/domain/VideoPreviewSurface';

export type VideoPreviewSurfaceFactory = () => VideoPreviewSurface;

/**
 * `SwitchableVideoPreviewSurface` that builds each variant on first
 * use and delegates every call to the active one — a session that
 * never plays a proxy never spawns the canvas variant's decode
 * worker, and vice versa.
 *
 * A switch tears the outgoing presentation down, stands the incoming
 * one up on the same container, and carries volume, playback rate,
 * the footage layers and the audio mix over. The loaded source is not carried — per the interface
 * contract, a switch happens right before a `load`.
 *
 * A `lockedVariant` (a forced boot preference) pins the surface to
 * one variant; `selectVariantForSource` is then a no-op.
 */
export class LazySwitchableVideoPreviewSurface extends EventTarget implements SwitchableVideoPreviewSurface {

  private readonly builtSurfaces = new Map<PreviewSurfaceVariant, VideoPreviewSurface>();
  private currentVariant: PreviewSurfaceVariant;
  private container: HTMLElement | null = null;
  private footage: PreviewFootage | null = null;
  private audioMix: PreviewAudioMix | null = null;

  constructor(
    private readonly factories: Record<PreviewSurfaceVariant, VideoPreviewSurfaceFactory>,
    initialVariant: PreviewSurfaceVariant,
    private readonly lockedVariant: boolean,
  ) {
    super();
    this.currentVariant = initialVariant;
  }

  get activeVariant(): PreviewSurfaceVariant {
    return this.currentVariant;
  }

  selectVariantForSource(isProxy: boolean): void {
    if (this.lockedVariant) return;
    const desired: PreviewSurfaceVariant = isProxy ? 'canvas' : 'native';
    if (desired === this.currentVariant) return;
    this.switchTo(desired);
  }

  start(container: HTMLElement): void {
    this.container = container;
    this.activeSurface().start(container);
  }

  stop(): void {
    this.container = null;
    for (const surface of this.builtSurfaces.values()) surface.stop();
  }

  load(source: Blob): Promise<void> {
    return this.activeSurface().load(source);
  }

  unload(): void {
    this.activeSurface().unload();
  }

  play(): Promise<void> {
    return this.activeSurface().play();
  }

  pause(): void {
    this.activeSurface().pause();
  }

  seek(sourceTimeSec: number): void {
    this.activeSurface().seek(sourceTimeSec);
  }

  setVolume(level: number): void {
    this.activeSurface().setVolume(level);
  }

  setPlaybackRate(rate: number): void {
    this.activeSurface().setPlaybackRate(rate);
  }

  beginScrub(): void {
    this.activeSurface().beginScrub();
  }

  endScrub(): void {
    this.activeSurface().endScrub();
  }

  scheduleAudioMuteAt(sourceTimeSec: number): void {
    this.activeSurface().scheduleAudioMuteAt(sourceTimeSec);
  }

  cancelScheduledAudioMute(): void {
    this.activeSurface().cancelScheduledAudioMute();
  }

  scheduleStopAt(sourceTimeSec: number): void {
    this.activeSurface().scheduleStopAt(sourceTimeSec);
  }

  cancelScheduledStop(): void {
    this.activeSurface().cancelScheduledStop();
  }

  setFootage(footage: PreviewFootage): void {
    this.footage = footage;
    this.activeSurface().setFootage(footage);
  }

  setAudioMix(mix: PreviewAudioMix): void {
    this.audioMix = mix;
    this.activeSurface().setAudioMix(mix);
  }

  isShowingFootage(): boolean {
    return this.activeSurface().isShowingFootage();
  }

  shownPicture(): PreviewShownPicture | null {
    return this.activeSurface().shownPicture();
  }

  snapshot(): VideoPreviewSurfaceSnapshot {
    return this.activeSurface().snapshot();
  }

  captureStream(): MediaStream | null {
    return this.activeSurface().captureStream();
  }

  captureFootageStream(): MediaStream | null {
    return this.activeSurface().captureFootageStream();
  }

  private switchTo(variant: PreviewSurfaceVariant): void {
    const outgoing = this.builtSurfaces.get(this.currentVariant);
    const carried = outgoing?.snapshot() ?? null;
    outgoing?.stop();
    this.currentVariant = variant;
    const incoming = this.activeSurface();
    if (this.container) incoming.start(this.container);
    if (carried) {
      incoming.setVolume(carried.volume);
      incoming.setPlaybackRate(carried.playbackRate);
    }
    if (this.footage !== null) incoming.setFootage(this.footage);
    if (this.audioMix !== null) incoming.setAudioMix(this.audioMix);
    this.dispatchEvent(new Event('variantchange'));
    this.dispatchEvent(new Event('change'));
  }

  private activeSurface(): VideoPreviewSurface {
    const existing = this.builtSurfaces.get(this.currentVariant);
    if (existing) return existing;
    const built = this.factories[this.currentVariant]();
    this.builtSurfaces.set(this.currentVariant, built);
    this.forwardEventsFrom(built);
    return built;
  }

  /**
   * Re-dispatches the base surface events, but only while the
   * emitting surface is the active one — a torn-down variant may
   * still settle async work, and its late events must not leak into
   * the session the other variant now owns.
   */
  private forwardEventsFrom(surface: VideoPreviewSurface): void {
    for (const type of ['timechange', 'change', 'footagechange'] as const) {
      surface.addEventListener(type, () => {
        if (this.builtSurfaces.get(this.currentVariant) === surface) {
          this.dispatchEvent(new Event(type));
        }
      });
    }
  }
}
