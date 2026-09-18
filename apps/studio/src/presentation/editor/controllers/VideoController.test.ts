import { describe, expect, it } from 'vitest';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type {
  VideoPreviewSurface,
  VideoPreviewSurfaceSnapshot,
} from '@core/preview/domain/VideoPreviewSurface';
import { EditorStore } from '@core/editor/store/EditorStore';
import { VideoController } from '@presentation/editor/controllers/VideoController';

class StubSurface extends EventTarget implements VideoPreviewSurface {
  durationSec: number | null = null;
  isReady = false;

  start(): void {}
  stop(): void {}
  async load(): Promise<void> {}
  unload(): void {}
  async play(): Promise<void> {}
  pause(): void {}
  seek(): void {}
  setVolume(): void {}
  setPlaybackRate(): void {}
  beginScrub(): void {}
  endScrub(): void {}
  scheduleAudioMuteAt(): void {}
  cancelScheduledAudioMute(): void {}
  scheduleStopAt(): void {}
  cancelScheduledStop(): void {}
  captureStream(): MediaStream | null { return null; }

  snapshot(): VideoPreviewSurfaceSnapshot {
    return {
      currentTimeSec: 0,
      durationSec: this.durationSec,
      isPlaying: false,
      volume: 1,
      playbackRate: 1,
      videoSize: null,
      isReady: this.isReady,
      loadFailure: null,
    };
  }

  publish(): void {
    this.dispatchEvent(new Event('change'));
  }
}

function build(): { surface: StubSurface; store: EditorStore } {
  const surface = new StubSurface();
  const store = new EditorStore();
  const documentBuilder = { build: () => null } as unknown as CutAwareDocumentBuilder;
  new VideoController(surface, store, documentBuilder).start();
  return { surface, store };
}

describe('VideoController duration publishing', () => {
  it('keeps the probed duration when the ready surface does not know one', () => {
    const { surface, store } = build();
    store.setDuration(26.33);

    surface.isReady = true;
    surface.durationSec = null;
    surface.publish();

    expect(store.snapshot().video.duration).toBe(26.33);
  });

  it('publishes the duration once the surface reports one', () => {
    const { surface, store } = build();
    store.setDuration(26.33);

    surface.isReady = true;
    surface.durationSec = 26.44;
    surface.publish();

    expect(store.snapshot().video.duration).toBe(26.44);
  });
});
