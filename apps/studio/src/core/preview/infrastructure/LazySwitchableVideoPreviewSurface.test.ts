import { describe, expect, it } from 'vitest';
import type { PreviewAudioMix } from '@core/preview/domain/PreviewAudioMix';
import type { PreviewFootage } from '@core/preview/domain/PreviewFootage';
import type {
  VideoPreviewSurface,
  VideoPreviewSurfaceSnapshot,
} from '@core/preview/domain/VideoPreviewSurface';
import { LazySwitchableVideoPreviewSurface } from '@core/preview/infrastructure/LazySwitchableVideoPreviewSurface';

class RecordingSurface extends EventTarget implements VideoPreviewSurface {
  startedOn: HTMLElement | null = null;
  stopped = false;
  loaded: Blob | null = null;
  volume = 1;
  playbackRate = 1;
  footage: PreviewFootage | null = null;
  audioMix: PreviewAudioMix | null = null;

  start(container: HTMLElement): void { this.startedOn = container; this.stopped = false; }
  stop(): void { this.stopped = true; this.startedOn = null; }
  async load(source: Blob): Promise<void> { this.loaded = source; }
  unload(): void { this.loaded = null; }
  async play(): Promise<void> {}
  pause(): void {}
  seek(): void {}
  setVolume(level: number): void { this.volume = level; }
  setPlaybackRate(rate: number): void { this.playbackRate = rate; }
  beginScrub(): void {}
  endScrub(): void {}
  scheduleAudioMuteAt(): void {}
  cancelScheduledAudioMute(): void {}
  scheduleStopAt(): void {}
  cancelScheduledStop(): void {}
  snapshot(): VideoPreviewSurfaceSnapshot {
    return {
      currentTimeSec: 0,
      durationSec: 0,
      isPlaying: false,
      volume: this.volume,
      playbackRate: this.playbackRate,
      videoSize: null,
      isReady: true,
      loadFailure: null,
    };
  }
  captureStream(): MediaStream | null { return null; }
  captureFootageStream(): MediaStream | null { return null; }
  setFootage(footage: PreviewFootage): void { this.footage = footage; }
  setAudioMix(mix: PreviewAudioMix): void { this.audioMix = mix; }
  isShowingFootage(): boolean { return false; }
  shownPicture(): null { return null; }
}

function build(locked = false) {
  const canvas = new RecordingSurface();
  const native = new RecordingSurface();
  const surface = new LazySwitchableVideoPreviewSurface(
    { canvas: () => canvas, native: () => native },
    'canvas',
    locked,
  );
  return { surface, canvas, native };
}

const CONTAINER = {} as HTMLElement;

describe('LazySwitchableVideoPreviewSurface', () => {
  it('plays a raw source on the native variant and a proxy on the canvas one', async () => {
    const { surface, canvas, native } = build();
    surface.start(CONTAINER);

    surface.selectVariantForSource(false);
    await surface.load(new Blob(['source']));
    expect(surface.activeVariant).toBe('native');
    expect(native.loaded).not.toBeNull();
    expect(native.startedOn).toBe(CONTAINER);

    surface.selectVariantForSource(true);
    await surface.load(new Blob(['proxy']));
    expect(surface.activeVariant).toBe('canvas');
    expect(canvas.loaded).not.toBeNull();
    expect(canvas.startedOn).toBe(CONTAINER);
    expect(native.stopped).toBe(true);
  });

  it('carries volume and playback rate across a switch', () => {
    const { surface, native } = build();
    surface.start(CONTAINER);
    surface.setVolume(0.3);
    surface.setPlaybackRate(1.5);

    surface.selectVariantForSource(false);

    expect(native.volume).toBe(0.3);
    expect(native.playbackRate).toBe(1.5);
  });

  it('carries the footage layers across a switch', () => {
    const { surface, native } = build();
    surface.start(CONTAINER);
    const footage: PreviewFootage = {
      layers: [{
        id: 'clip',
        source: { kind: 'video', blob: new Blob(['clip']) },
        outputStartSec: 2,
        outputEndSec: 4,
        sourceStartSec: 0,
        sourcePassSec: Infinity,
      }],
      resolver: { resolveAt: () => [], dispose: () => {} },
      frame: { width: 1080, height: 1920 },
      outputEndSec: null,
      grade: null,
    };
    surface.setFootage(footage);

    surface.selectVariantForSource(false);

    expect(native.footage).toBe(footage);
  });

  it('carries the audio mix across a switch', () => {
    const { surface, native } = build();
    surface.start(CONTAINER);
    const mix: PreviewAudioMix = { layers: [], inputGain: 0.5, inputDucks: [], outputDurationSec: 10 };
    surface.setAudioMix(mix);

    surface.selectVariantForSource(false);

    expect(native.audioMix).toBe(mix);
  });

  it('never switches when the variant is locked', () => {
    const { surface } = build(true);
    surface.selectVariantForSource(false);
    expect(surface.activeVariant).toBe('canvas');
  });

  it('announces a switch and drops events from the variant that was torn down', () => {
    const { surface, canvas } = build();
    surface.start(CONTAINER);
    const seen: string[] = [];
    surface.addEventListener('variantchange', () => seen.push('variantchange'));
    surface.addEventListener('change', () => seen.push('change'));

    surface.selectVariantForSource(false);
    canvas.dispatchEvent(new Event('change'));

    expect(seen).toContain('variantchange');
    // Exactly one 'change': the switch announcement. The torn-down
    // canvas surface's late event must not have been forwarded.
    expect(seen.filter((type) => type === 'change')).toHaveLength(1);
  });
});
