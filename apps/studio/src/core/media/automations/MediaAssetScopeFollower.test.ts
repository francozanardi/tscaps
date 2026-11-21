import { describe, expect, it, vi } from 'vitest';
import { MediaLibraryTelemetryReporter } from '@core/media/services/MediaLibraryTelemetryReporter';
import { EditorStore } from '@core/editor/store/EditorStore';
import { LoadMediaAssetsAction } from '@core/media/actions/LoadMediaAssetsAction';
import { MoveMediaAssetAction } from '@core/media/actions/MoveMediaAssetAction';
import { MediaAssetScopeFollower } from '@core/media/automations/MediaAssetScopeFollower';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetBytesRepository } from '@core/media/domain/MediaAssetBytesRepository';
import type { MediaAssetListChanges } from '@core/media/domain/MediaAssetListChanges';
import type { MediaAssetRepository } from '@core/media/domain/MediaAssetRepository';
import { DeviceOnlyMediaAssetUploader } from '@core/media/infrastructure/DeviceOnlyMediaAssetUploader';
import { OpenMediaLibraryAccess } from '@core/media/infrastructure/OpenMediaLibraryAccess';
import { MediaAssetOriginalsPrefetcher } from '@core/media/services/MediaAssetOriginalsPrefetcher';
import { MediaAssetOwnerResolver } from '@core/media/services/MediaAssetOwnerResolver';
import { MediaAssetPreparer } from '@core/media/services/MediaAssetPreparer';
import { MediaAssetStore } from '@core/media/store/MediaAssetStore';
import type { PreviewProxyGenerator } from '@core/preview/domain/PreviewProxyGenerator';

const PLAYS = { ensurePlayable: async () => undefined };

/**
 * The files on offer follow the open project, and are read again when
 * their list may have changed where it lives. A list that cannot be had
 * never takes away the files already shown for the same project — a
 * dropped connection is not an empty list — and never leaves another
 * project's files on offer.
 */

function picture(id: string): MediaAsset {
  return { id, type: 'image', owner: { kind: 'library' }, fileName: `${id}.png`, mimeType: 'image/png', sizeBytes: 3, widthPx: 1, heightPx: 1, durationSec: null };
}

/** Where the list lives: answers what it holds now, or fails while unreachable. */
class RemoteList implements MediaAssetRepository {
  readonly held = new Map<string | null, readonly MediaAsset[]>();
  unreachable = false;
  /** While set, a listing waits for it before reading. */
  gate: Promise<void> | null = null;
  reads = 0;

  async list(projectId: string | null): Promise<readonly MediaAsset[]> {
    this.reads += 1;
    const snapshot = this.held.get(projectId) ?? [];
    const unreachable = this.unreachable;
    if (this.gate) await this.gate;
    if (unreachable) throw new TypeError('Failed to fetch');
    return snapshot;
  }

  add(): Promise<void> { return Promise.resolve(); }
  move(): Promise<void> { return Promise.resolve(); }
  delete(): Promise<void> { return Promise.resolve(); }
}

class HeardChanges implements MediaAssetListChanges {
  private readonly listeners = new Set<(projectId: string) => void>();

  subscribe(listener: (projectId: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  changed(projectId: string): void {
    for (const listener of this.listeners) listener(projectId);
  }
}

const NO_BYTES = {
  load: () => Promise.resolve(null),
  store: () => Promise.resolve(),
  reassign: () => Promise.resolve(),
  delete: () => Promise.resolve(),
} as unknown as MediaAssetBytesRepository;

function harness() {
  const remote = new RemoteList();
  const changes = new HeardChanges();
  const editorStore = new EditorStore();
  editorStore.patch({ projectId: 'project' });
  const assets = new MediaAssetStore();
  const uploader = new DeviceOnlyMediaAssetUploader();
  const preparer = new MediaAssetPreparer(NO_BYTES, {} as PreviewProxyGenerator, uploader, PLAYS, PLAYS);
  const load = new LoadMediaAssetsAction(remote, assets, preparer, new MediaAssetOriginalsPrefetcher(NO_BYTES), uploader);
  const move = new MoveMediaAssetAction(editorStore, assets, remote, NO_BYTES, new MediaAssetOwnerResolver(new OpenMediaLibraryAccess()), uploader, new MediaLibraryTelemetryReporter({ capture: () => undefined }));
  const follower = new MediaAssetScopeFollower(editorStore, assets, load, move, changes);
  const shown = () => assets.snapshot().list().map((asset) => asset.id).sort();
  return { remote, changes, editorStore, follower, shown };
}

/** Lets every listing already asked for settle. */
async function settled(remote: RemoteList, reads: number): Promise<void> {
  await vi.waitFor(() => expect(remote.reads).toBe(reads));
  for (let turn = 0; turn < 5; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('the files on offer for the open project', () => {
  it('are read again when their list changes where it lives', async () => {
    const { remote, changes, follower, shown } = harness();
    remote.held.set('project', [picture('logo')]);
    follower.start();
    await vi.waitFor(() => expect(shown()).toEqual(['logo']));

    remote.held.set('project', [picture('logo'), picture('clip')]);
    changes.changed('project');

    await vi.waitFor(() => expect(shown()).toEqual(['clip', 'logo']));
  });

  it('are read afresh when the change comes while a read is still under way', async () => {
    const { remote, changes, follower, shown } = harness();
    let open!: () => void;
    remote.gate = new Promise((resolve) => { open = resolve; });
    remote.held.set('project', [picture('logo')]);
    follower.start();

    remote.held.set('project', [picture('logo'), picture('clip')]);
    changes.changed('project');
    remote.gate = null;
    open();

    await settled(remote, 2);
    expect(shown()).toEqual(['clip', 'logo']);
  });

  it('stay as they are when the list cannot be had', async () => {
    const { remote, changes, follower, shown } = harness();
    remote.held.set('project', [picture('logo')]);
    follower.start();
    await vi.waitFor(() => expect(shown()).toEqual(['logo']));

    remote.unreachable = true;
    changes.changed('project');

    await settled(remote, 2);
    expect(shown()).toEqual(['logo']);
  });

  it("never stay another project's when that project's list cannot be had", async () => {
    const { remote, editorStore, follower, shown } = harness();
    remote.held.set('project', [picture('logo')]);
    follower.start();
    await vi.waitFor(() => expect(shown()).toEqual(['logo']));

    remote.unreachable = true;
    editorStore.patch({ projectId: 'another' });

    await settled(remote, 2);
    expect(shown()).toEqual([]);
  });

  it("are not read again for a change to a project that is not open", async () => {
    const { remote, changes, follower } = harness();
    follower.start();
    await settled(remote, 1);

    changes.changed('another');

    await settled(remote, 1);
  });
});
