import { describe, expect, it } from 'vitest';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import { PreviewProxyGenerationPolicy } from '@core/preview/services/PreviewProxyGenerationPolicy';

function metadata(overrides: Partial<VideoSourceMetadata>): VideoSourceMetadata {
  return {
    mimeType: 'video/mp4',
    sourceReadable: true,
    containerFormat: 'MP4',
    durationSeconds: 30,
    videoCodec: 'avc',
    videoWidthPx: 1080,
    videoHeightPx: 1920,
    hasAudioTrack: true,
    audioCodec: 'aac',
    audioSampleRate: 44100,
    audioChannels: 2,
    ...overrides,
  };
}

const mobile = new PreviewProxyGenerationPolicy(true);
const desktop = new PreviewProxyGenerationPolicy(false);

describe('PreviewProxyGenerationPolicy on mobile', () => {
  it('generates for a short FHD source', () => {
    expect(mobile.shouldGenerate(metadata({}))).toBe(true);
  });

  it('generates right up to 1080x1920 worth of pixels and skips past it', () => {
    expect(mobile.shouldGenerate(metadata({ videoWidthPx: 1920, videoHeightPx: 1080 }))).toBe(true);
    expect(mobile.shouldGenerate(metadata({ videoWidthPx: 1440, videoHeightPx: 2560 }))).toBe(false);
  });

  it('skips a 4K source whichever way round it is', () => {
    expect(mobile.shouldGenerate(metadata({ videoWidthPx: 2160, videoHeightPx: 3840 }))).toBe(false);
    expect(mobile.shouldGenerate(metadata({ videoWidthPx: 3840, videoHeightPx: 2160 }))).toBe(false);
  });
});

/**
 * Duration decides nothing here any more. It used to refuse a source
 * outright — 90 s on mobile, 10 min on desktop — but how long an encode
 * is worth waiting for is now measured while it runs, and refusing a
 * long video up front denied a proxy to exactly the sources that most
 * need one.
 */
describe('PreviewProxyGenerationPolicy on duration', () => {
  it('starts on a source longer than either old budget', () => {
    expect(mobile.shouldGenerate(metadata({ durationSeconds: 20 * 60 }))).toBe(true);
    expect(desktop.shouldGenerate(metadata({ durationSeconds: 20 * 60 }))).toBe(true);
  });

  it('still refuses a long source a phone should not decode', () => {
    const long4k = { durationSeconds: 20 * 60, videoWidthPx: 3840, videoHeightPx: 2160 };
    expect(mobile.shouldGenerate(metadata(long4k))).toBe(false);
  });
});

describe('PreviewProxyGenerationPolicy on desktop', () => {
  // The ceiling guards a phone's decoder, not a desktop's patience.
  it('ignores resolution entirely, 4K included', () => {
    expect(desktop.shouldGenerate(metadata({ videoWidthPx: 3840, videoHeightPx: 2160 }))).toBe(true);
  });
});

describe('PreviewProxyGenerationPolicy without metadata', () => {
  it('generates when the deciding fields are unknown', () => {
    const unknown = metadata({ durationSeconds: null, videoWidthPx: null, videoHeightPx: null });
    expect(mobile.shouldGenerate(unknown)).toBe(true);
    expect(desktop.shouldGenerate(unknown)).toBe(true);
  });
});
