import { describe, expect, it } from 'vitest';
import type { BlobReadability, BlobReadabilityProbe } from '@core/_shared/domain/BlobReadabilityProbe';
import { EditorStore } from '@core/editor/store/EditorStore';
import { OriginalVideoDownloadStore } from '@core/projects/store/OriginalVideoDownloadStore';
import type { Telemetry } from '@core/telemetry/domain/Telemetry';
import type { TelemetryEventProperties } from '@shared/telemetry';
import type { VideoBlobLookup } from '@core/videos/domain/VideoBlobLookup';
import type { OriginalVideoKeeper } from '@core/videos/services/OriginalVideoKeeper';
import { OriginalVideoResolver } from '@core/videos/services/OriginalVideoResolver';
import { RecoverPreviewSourceAction } from '@core/videos/actions/RecoverPreviewSourceAction';

/**
 * The promise: when the original a preview plays stops reading, the
 * preview gets readable bytes of the same video back, or the editor
 * says plainly that none can be had and whether a reload would bring
 * them. Every case starts from a preview that just stopped.
 */

class ListedProbe implements BlobReadabilityProbe {
  private readonly listed = new Map<Blob, BlobReadability>();

  mark(blob: Blob, readability: BlobReadability): void {
    this.listed.set(blob, readability);
  }

  probe(blob: Blob): Promise<BlobReadability> {
    return Promise.resolve(this.listed.get(blob) ?? 'readable');
  }
}

class RecordingTelemetry implements Telemetry {
  readonly events: Array<{ event: string; properties: TelemetryEventProperties | undefined }> = [];

  capture(event: string, properties?: TelemetryEventProperties): void {
    this.events.push({ event, properties });
  }
}

/** Answers with whatever copy it was last given. */
class SettableKeeper {
  constructor(public storedCopy: VideoBlobLookup) {}

  asKeeper(): OriginalVideoKeeper {
    return { storedCopy: async () => this.storedCopy } as unknown as OriginalVideoKeeper;
  }
}

interface Harness {
  readonly action: RecoverPreviewSourceAction;
  readonly store: EditorStore;
  readonly probe: ListedProbe;
  readonly keeper: SettableKeeper;
  readonly telemetry: RecordingTelemetry;
}

function buildHarness(options: { storedCopy?: VideoBlobLookup; videoIsUploaded?: boolean } = {}): Harness {
  const store = new EditorStore();
  const probe = new ListedProbe();
  const keeper = new SettableKeeper(options.storedCopy ?? { outcome: 'missing', reason: 'absent' });
  const telemetry = new RecordingTelemetry();
  const resolver = new OriginalVideoResolver(store, probe, keeper.asKeeper(), new OriginalVideoDownloadStore());
  return {
    action: new RecoverPreviewSourceAction(store, resolver, telemetry, options.videoIsUploaded ?? false),
    store,
    probe,
    keeper,
    telemetry,
  };
}

/** A fresh import: the preview plays the very file the reader picked, which has stopped reading. */
function previewPickedFileThatStopped(harness: Harness): File {
  const picked = new File(['frames'], 'clip.mp4', { type: 'video/mp4' });
  harness.store.patch({
    video: {
      file: picked,
      url: URL.createObjectURL(picked),
      fileName: picked.name,
      mimeType: picked.type,
      size: picked.size,
      preview: { kind: 'original', file: picked, reason: 'policy-skipped' },
    },
  });
  harness.probe.mark(picked, 'gone');
  return picked;
}

const storedBytes = () => new Blob(['frames'], { type: 'video/mp4' });

describe('RecoverPreviewSourceAction', () => {
  it('plays the copy kept on this device in place of a picked file that stopped reading', async () => {
    const harness = buildHarness({ storedCopy: { outcome: 'found', blob: storedBytes(), source: 'device' } });
    const picked = previewPickedFileThatStopped(harness);

    await harness.action.execute();

    const { video } = harness.store.snapshot();
    expect(video.preview?.file).not.toBe(picked);
    expect(video.preview).toMatchObject({ kind: 'original', reason: 'policy-skipped' });
    expect(video.file).toBe(video.preview?.file);
    expect(video.file?.name).toBe('clip.mp4');
    expect(video.sourceUnavailable).toBeNull();
    expect(harness.telemetry.events).toEqual([
      { event: 'original_video_recovered', properties: { context: 'preview', video_source: 'device' } },
    ]);
  });

  it('says the video must be chosen again when no copy is left and nothing is on a server', async () => {
    const harness = buildHarness();
    const picked = previewPickedFileThatStopped(harness);

    await harness.action.execute();

    const { video } = harness.store.snapshot();
    expect(video.preview?.file).toBe(picked);
    expect(video.sourceUnavailable).toMatchObject({ name: 'OriginalVideoUnavailableError', hasRemoteCopy: false });
    expect(harness.telemetry.events).toEqual([{
      event: 'original_video_unavailable',
      properties: { context: 'preview', reason: 'held-file-gone', has_remote_copy: false },
    }]);
  });

  it('says a reload brings it back when a server keeps the project', async () => {
    const harness = buildHarness({ videoIsUploaded: true });
    previewPickedFileThatStopped(harness);
    harness.store.patch({ projectId: 'project-1' });

    await harness.action.execute();

    expect(harness.store.snapshot().video.sourceUnavailable).toMatchObject({ hasRemoteCopy: true });
  });

  it('does not go round again when the copy it put in place stops reading too', async () => {
    const harness = buildHarness({ storedCopy: { outcome: 'found', blob: storedBytes(), source: 'device' } });
    previewPickedFileThatStopped(harness);
    await harness.action.execute();
    const recovered = harness.store.snapshot().video.preview?.file;

    await harness.action.execute();

    const { video } = harness.store.snapshot();
    expect(video.preview?.file).toBe(recovered);
    expect(video.sourceUnavailable).toMatchObject({ hasRemoteCopy: false });
  });

  it('leaves the editor alone when another video took the preview while the copies were looked for', async () => {
    const harness = buildHarness();
    previewPickedFileThatStopped(harness);
    const another = new File(['other'], 'other.mp4', { type: 'video/mp4' });

    const running = harness.action.execute();
    harness.store.patchVideo({ preview: { kind: 'original', file: another, reason: 'policy-skipped' } });
    await running;

    const { video } = harness.store.snapshot();
    expect(video.preview?.file).toBe(another);
    expect(video.sourceUnavailable).toBeNull();
  });

  it('does nothing while the preview plays a proxy', async () => {
    const harness = buildHarness({ storedCopy: { outcome: 'found', blob: storedBytes(), source: 'device' } });
    const proxy = new Blob(['proxy'], { type: 'video/mp4' });
    harness.store.patchVideo({ preview: { kind: 'proxy', file: proxy } });

    await harness.action.execute();

    const { video } = harness.store.snapshot();
    expect(video.preview?.file).toBe(proxy);
    expect(video.sourceUnavailable).toBeNull();
    expect(harness.telemetry.events).toEqual([]);
  });

  it('takes a file chosen again as the way out, after none could be found', async () => {
    const harness = buildHarness();
    previewPickedFileThatStopped(harness);
    await harness.action.execute();
    harness.keeper.storedCopy = { outcome: 'found', blob: storedBytes(), source: 'device' };
    const chosenAgain = new File(['frames'], 'clip.mp4', { type: 'video/mp4' });
    harness.store.patchVideo({
      file: chosenAgain,
      preview: { kind: 'original', file: chosenAgain, reason: 'policy-skipped' },
      sourceUnavailable: null,
    });
    harness.probe.mark(chosenAgain, 'gone');

    await harness.action.execute();

    expect(harness.store.snapshot().video.sourceUnavailable).toBeNull();
    expect(harness.store.snapshot().video.preview?.file).not.toBe(chosenAgain);
  });
});
