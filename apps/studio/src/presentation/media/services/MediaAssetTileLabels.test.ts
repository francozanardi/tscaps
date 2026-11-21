import { describe, expect, it } from 'vitest';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { MediaAssetTileLabels } from '@presentation/media/services/MediaAssetTileLabels';
import type { MediaFileUsage } from '@presentation/media/services/MediaFileUsage';

const labels = new MediaAssetTileLabels();

function usage(used: Partial<MediaFileUsage>): MediaFileUsage {
  return { shots: 0, isMusic: false, soundEffects: 0, ...used };
}

const PICTURE: MediaAsset = {
  id: 'p', type: 'image', owner: { kind: 'library' }, fileName: '  ', mimeType: 'image/png',
  sizeBytes: 25 * 1024 * 1024, widthPx: 1080, heightPx: 1920, durationSec: null,
};

const AUDIO: MediaAsset = {
  ...PICTURE, id: 'a', type: 'audio', fileName: 'theme.mp3', mimeType: 'audio/mpeg',
  sizeBytes: 4.5 * 1024 * 1024, widthPx: null, heightPx: null, durationSec: 185,
};

describe('the words on a media tile', () => {
  it('gives no length to what does not play, and reads a clip like a shot', () => {
    expect(labels.durationOf(PICTURE)).toBeNull();
    expect(labels.durationOf({ ...PICTURE, type: 'video', durationSec: 7.04 })).toBe('7.0s');
  });

  it('reads the length of an audio file the way a song reads', () => {
    expect(labels.durationOf({ ...AUDIO, durationSec: 185.4 })).toBe('3:05');
    expect(labels.durationOf({ ...AUDIO, durationSec: 4.2 })).toBe('0:04');
  });

  it('names a file with no name rather than showing a blank', () => {
    expect(labels.nameOf(PICTURE)).toBe('Untitled file');
  });

  it('counts the shots showing a file', () => {
    expect(labels.usageOf(undefined)).toBe('Not used');
    expect(labels.usageOf(usage({ shots: 1 }))).toBe('1 shot');
    expect(labels.usageOf(usage({ shots: 4 }))).toBe('4 shots');
  });

  it('never calls a file the soundtrack plays unused', () => {
    expect(labels.usageOf(usage({ isMusic: true }))).toBe('Music');
    expect(labels.usageOf(usage({ soundEffects: 1 }))).toBe('1 sound');
    expect(labels.usageOf(usage({ shots: 1, isMusic: true, soundEffects: 3 }))).toBe('1 shot · Music · 3 sounds');
  });

  it('warns that a file is about to be deleted only when nothing here uses it', () => {
    expect(labels.usageOf(undefined, 'Deleted in 3 days')).toBe('Deleted in 3 days');
    expect(labels.usageOf(usage({ shots: 2 }), 'Deleted in 3 days')).toBe('2 shots');
    expect(labels.usageOf(usage({ soundEffects: 1 }), 'Deleted in 3 days')).toBe('1 sound');
  });

  it('gives the size in pixels and whole megabytes past ten', () => {
    expect(labels.detailsOf(PICTURE)).toBe('1080 × 1920 · 25 MB');
  });

  it('gives an audio file, which has no size in pixels, its weight alone', () => {
    expect(labels.detailsOf(AUDIO)).toBe('4.5 MB');
  });
});
