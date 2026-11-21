import { describe, expect, it } from 'vitest';
import { AudioMix } from '@core/audio-mix/domain/AudioMix';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import type { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import { ProjectOpenTelemetryReporter } from '@core/projects/services/ProjectOpenTelemetryReporter';
import { ShotPartition } from '@core/shots/domain/ShotPartition';
import type { TelemetryEventProperties } from '@shared/telemetry';

const LISTED: MediaAsset = {
  id: 'listed',
  type: 'video',
  owner: { kind: 'library' },
  fileName: 'listed.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 1,
  widthPx: 2,
  heightPx: 2,
  durationSec: 1,
};

describe('ProjectOpenTelemetryReporter', () => {
  it('says how many files an opened project uses and how many of them are gone, never which', () => {
    const store = new EditorStore();
    store.patch({
      shots: ShotPartition.fromSnapshot({ maxShotSec: 4, shots: [{ id: 'a', startSec: 0, layers: [
        { id: 'roll', mediaId: 'listed', inSec: 0, outSec: null, loop: false },
        { id: 'still', mediaId: 'expired', inSec: 0, outSec: null, loop: false },
      ] }] }),
      audio: AudioMix.fromSnapshot({ sourceVolume: 1, clips: [{
        id: 'song',
        role: 'music',
        source: { kind: 'media', mediaId: 'deleted-song' },
        start: { anchor: { kind: 'video', edge: 'start' }, offsetSec: 0 },
        end: null,
        inSec: 0,
        loop: false,
        volume: 1,
        fadeInSec: 0,
        fadeOutSec: 0,
        ducking: { enabled: false, depthDb: -12 },
      }] }),
    });
    const assets = new MediaAssetStore();
    assets.put(LISTED);
    const captured: TelemetryEventProperties[] = [];
    const reporter = new ProjectOpenTelemetryReporter(
      store,
      assets,
      { capture: (_name, properties) => { captured.push(properties ?? {}); } },
      {} as AppErrorClassifier,
      {} as AppErrorTelemetryDescriber,
    );

    reporter.reportOpened(0, 'device', 10);

    expect(captured[0]).toMatchObject({ media_files_in_use: 3, media_files_missing: 2 });
    expect(JSON.stringify(captured)).not.toContain('expired');
  });
});
