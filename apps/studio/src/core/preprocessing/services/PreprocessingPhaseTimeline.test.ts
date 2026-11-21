import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreprocessingPhaseTimeline } from '@core/preprocessing/services/PreprocessingPhaseTimeline';
import { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';

describe('PreprocessingPhaseTimeline', () => {
  let store: PreprocessingProgressStore;
  let timeline: PreprocessingPhaseTimeline;

  beforeEach(() => {
    // `performance` is outside the default fake set, and it is the
    // clock the timeline reads.
    vi.useFakeTimers({ toFake: ['performance'] });
    store = new PreprocessingProgressStore();
    timeline = new PreprocessingPhaseTimeline(store);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports how long each phase was the current one', () => {
    store.start('audio-extract');
    timeline.start();

    vi.advanceTimersByTime(1000);
    store.enterInferringPhase();
    vi.advanceTimersByTime(2000);
    store.enterPreviewProxyPhase();
    timeline.stop();

    expect(timeline.toTelemetryProperties()).toEqual({
      audio_extract_ms: 1000,
      inferring_ms: 2000,
    });
  });

  it('reports how long a transcription waited its turn', () => {
    store.start('audio-extract');
    timeline.start();

    store.start('queued');
    vi.advanceTimersByTime(4000);
    store.start('audio-extract');
    vi.advanceTimersByTime(1000);
    store.enterInferringPhase();
    timeline.stop();

    expect(timeline.toTelemetryProperties()).toEqual({
      queued_ms: 4000,
      audio_extract_ms: 1000,
      inferring_ms: 0,
    });
  });

  it('sums a phase that is entered more than once', () => {
    store.start('audio-extract');
    timeline.start();

    vi.advanceTimersByTime(100);
    store.setModelDownloadProgress(0.5);
    vi.advanceTimersByTime(1000);
    store.setAudioExtractProgress(0.5);
    vi.advanceTimersByTime(200);
    timeline.stop();

    expect(timeline.toTelemetryProperties()).toEqual({
      audio_extract_ms: 300,
      model_download_ms: 1000,
    });
  });

  it('leaves out the preview-proxy phase, whose span is not its work', () => {
    store.start('audio-extract');
    timeline.start();

    store.enterPreviewProxyPhase();
    vi.advanceTimersByTime(5000);
    timeline.stop();

    expect(timeline.toTelemetryProperties()).not.toHaveProperty('preview_proxy_ms');
  });

  it('stops counting once stopped, however long the run stays open', () => {
    store.start('audio-extract');
    timeline.start();

    vi.advanceTimersByTime(500);
    timeline.stop();
    vi.advanceTimersByTime(9000);
    store.enterInferringPhase();

    expect(timeline.toTelemetryProperties()).toEqual({ audio_extract_ms: 500 });
  });
});
