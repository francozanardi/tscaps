import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { VideoBlobCache } from '@core/videos/domain/VideoBlobCache';
import type { VideoBlobLookup } from '@core/videos/domain/VideoBlobLookup';
import { OriginalVideoKeeper } from '@core/videos/services/OriginalVideoKeeper';

class InMemoryBlobCache implements VideoBlobCache {
  readonly entries = new Map<string, Blob>();

  refuseWrites = false;

  async load(projectId: string): Promise<VideoBlobLookup> {
    const blob = this.entries.get(projectId);
    if (!blob) return { outcome: 'missing', reason: 'absent' };
    return { outcome: 'found', blob, source: 'device' };
  }

  async store(projectId: string, blob: Blob): Promise<void> {
    if (this.refuseWrites) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    this.entries.set(projectId, blob);
  }

  async delete(projectId: string): Promise<void> {
    this.entries.delete(projectId);
  }
}

/** Keeps what it was handed, and answers only for that project. */
class InMemoryProjectVideos {
  readonly entries = new Map<string, Blob>();

  async cacheVideoBlob(projectId: string, blob: Blob): Promise<void> {
    this.entries.set(projectId, blob);
  }

  async loadVideoBlob(projectId: string): Promise<VideoBlobLookup> {
    const blob = this.entries.get(projectId);
    if (!blob) return { outcome: 'missing', reason: 'absent' };
    return { outcome: 'found', blob, source: 'server' };
  }
}

function buildKeeper(blobCache = new InMemoryBlobCache(), projects = new InMemoryProjectVideos()) {
  const editorStore = new EditorStore();
  const keeper = new OriginalVideoKeeper(editorStore, blobCache, projects as unknown as ProjectRepository);
  return { editorStore, blobCache, projects, keeper };
}

describe('OriginalVideoKeeper', () => {
  const bytes = () => new Blob(['frames'], { type: 'video/mp4' });

  it('gives back what a session with no project handed it', async () => {
    const { keeper } = buildKeeper();

    expect(await keeper.keep(bytes())).toBeNull();
    expect(await keeper.storedCopy()).toMatchObject({ outcome: 'found', source: 'device' });
  });

  it('puts the video of a project through the repository, which is what an upload reads from', async () => {
    const { editorStore, blobCache, projects, keeper } = buildKeeper();
    editorStore.patch({ projectId: 'project-1' });

    await keeper.keep(bytes());

    expect([...projects.entries.keys()]).toEqual(['project-1']);
    expect(blobCache.entries.size).toBe(0);
    expect(await keeper.storedCopy()).toMatchObject({ outcome: 'found', source: 'server' });
  });

  it('hands back what refused the write, and claims no copy afterwards', async () => {
    const blobCache = new InMemoryBlobCache();
    blobCache.refuseWrites = true;
    const { keeper } = buildKeeper(blobCache);

    expect(await keeper.keep(bytes())).toBeInstanceOf(DOMException);
    expect(await keeper.storedCopy()).toEqual({ outcome: 'missing', reason: 'absent' });
  });

  it('holds nothing for a session that never asked it to', async () => {
    const { keeper } = buildKeeper();

    expect(await keeper.storedCopy()).toEqual({ outcome: 'missing', reason: 'absent' });
  });
});
