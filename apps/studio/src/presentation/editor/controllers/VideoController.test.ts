import { describe, expect, it } from 'vitest';
import { TimeFragment } from '@tscaps/engine';
import type { Document } from '@tscaps/engine';
import { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { CutRange } from '@core/cuts/domain/CutRegistry';
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
  currentTimeSec = 0;
  cuts: ReadonlyArray<CutRange> = [];

  start(): void {}
  stop(): void {}
  async load(): Promise<void> {}
  unload(): void {}
  async play(): Promise<void> {}
  pause(): void {}

  seek(sourceTimeSec: number): void {
    const containing = this.cuts.find(c => sourceTimeSec >= c.startSec && sourceTimeSec < c.endSec);
    this.currentTimeSec = containing ? containing.endSec : sourceTimeSec;
  }
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
      currentTimeSec: this.currentTimeSec,
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

function buildNavigable(
  wordTimes: ReadonlyArray<[number, number]>,
  cuts: ReadonlyArray<CutRange>,
): { surface: StubSurface; controller: VideoController } {
  const surface = new StubSurface();
  surface.cuts = cuts;
  const store = new EditorStore();
  const words = wordTimes.map(([start, end]) => ({ time: new TimeFragment(start, end) }));
  const visible = { getWords: () => words, getSegments: () => [] };
  const documentBuilder = { build: () => visible } as unknown as CutAwareDocumentBuilder;
  store.patch({ document: {} as Document, cuts: CutRegistry.fromSnapshot(cuts) });
  const controller = new VideoController(surface, store, documentBuilder);
  controller.start();
  return { surface, controller };
}

describe('VideoController word navigation', () => {
  it('steps over a zero-length word in both directions', () => {
    const { surface, controller } = buildNavigable([[0, 1], [1.5, 1.5], [2, 3]], []);
    surface.currentTimeSec = 0.5;

    controller.nextWord();
    controller.nextWord();
    expect(surface.currentTimeSec).toBe(2.5);

    controller.prevWord();
    controller.prevWord();
    expect(surface.currentTimeSec).toBe(0.5);
  });

  it('lands on the part of a word a cut leaves standing, and moves on from it', () => {
    const { surface, controller } = buildNavigable([[0, 1], [1, 2], [3, 4]], [{ startSec: 1.5, endSec: 2.5 }]);
    surface.currentTimeSec = 3.5;

    controller.prevWord();
    expect(surface.currentTimeSec).toBeCloseTo(1.25);

    controller.prevWord();
    expect(surface.currentTimeSec).toBeCloseTo(0.5);
  });
});
