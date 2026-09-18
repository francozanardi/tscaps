import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ExportStore } from '@core/export/store/ExportStore';
import { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import { OriginalVideoDownloadFailedError } from '@core/projects/domain/errors/OriginalVideoDownloadFailedError';
import type { VideoMetadataProbe } from '@core/videos/domain/VideoMetadataProbe';
import type { VideoSourceMetadata } from '@core/videos/domain/VideoSourceMetadata';
import { LoadVideoAction } from '@core/videos/actions/LoadVideoAction';

/**
 * What a fresh video promises: the session that was open is over.
 * Two of the three stores it has to end live outside the editor
 * store, and until this action cleared them a failed download from
 * the project before stayed on screen and kept the export disabled
 * over a video the reader had just chosen.
 */

const METADATA: VideoSourceMetadata = {
  mimeType: 'video/mp4',
  sourceReadable: true,
  containerFormat: 'mp4',
  durationSeconds: 12,
  videoCodec: 'avc1',
  videoWidthPx: 1080,
  videoHeightPx: 1920,
  hasAudioTrack: true,
  audioCodec: 'aac',
  audioSampleRate: 48_000,
  audioChannels: 2,
};

function buildHarness() {
  const editorStore = new EditorStore();
  const exportStore = new ExportStore();
  const downloadStore = new OriginalVideoDownloadStore();
  const probe: VideoMetadataProbe = { probe: async () => METADATA };
  return {
    editorStore,
    exportStore,
    downloadStore,
    action: new LoadVideoAction(editorStore, exportStore, downloadStore, probe),
  };
}

const clip = () => new File(['frames'], 'clip.mp4', { type: 'video/mp4' });

describe('LoadVideoAction', () => {

  it('publishes the chosen file as the original of the new session', () => {
    const harness = buildHarness();
    const file = clip();

    harness.action.execute(file);

    expect(harness.editorStore.snapshot().video.file).toBe(file);
    expect(harness.editorStore.snapshot().video.fileName).toBe('clip.mp4');
  });

  it('ends a failed original-video download from the session it replaces', () => {
    const harness = buildHarness();
    harness.downloadStore.start();
    harness.downloadStore.fail(new OriginalVideoDownloadFailedError({ cause: new Error('offline') }));

    harness.action.execute(clip());

    expect(harness.downloadStore.status).toEqual({ kind: 'idle' });
  });

  it('ends the export state of the session it replaces', () => {
    const harness = buildHarness();
    harness.exportStore.start('rendering');
    harness.exportStore.finish({ kind: 'audio-discarded', reason: 'unknown-source-codec' });

    harness.action.execute(clip());

    expect(harness.exportStore.run).toBeNull();
    expect(harness.exportStore.notice).toBeNull();
  });
});
