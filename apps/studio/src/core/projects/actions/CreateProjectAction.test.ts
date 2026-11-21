import { describe, expect, it } from 'vitest';
import { CreateProjectAction } from '@core/projects/actions/CreateProjectAction';
import { EditorStore } from '@core/editor/store/EditorStore';
import { ProjectName } from '@core/projects/domain/ProjectName';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { ThumbnailGenerator } from '@core/projects/services/ThumbnailGenerator';

/**
 * A device with no room left must still get a project: the video is
 * in memory for the rest of the session, and refusing to establish
 * one would take away work that is otherwise editable and exportable.
 * What refused the copy is handed back rather than announced, because
 * whether it is worth saying depends on the save that follows.
 */

describe('CreateProjectAction', () => {
  const substitute = <T>(stub: object): T => stub as T;

  const buildAction = (repository: ProjectRepository) => {
    const store = new EditorStore();
    store.patchVideo({ file: new File(['frames'], 'holiday.mp4', { type: 'video/mp4' }) });
    const action = new CreateProjectAction(
      repository,
      substitute<ThumbnailGenerator>({ generate: () => Promise.resolve(new Blob()) }),
      new ProjectName(),
    );
    return { action, store };
  };

  const refusingRepository = () => substitute<ProjectRepository>({
    cacheVideoBlob: () => Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError')),
  });

  it('establishes the project when the device cannot keep the video', async () => {
    const { action, store } = buildAction(refusingRepository());

    await action.execute('project-1', () => store);

    expect(store.snapshot().projectId).toBe('project-1');
    expect(store.snapshot().projectName).toBe('holiday');
  });

  it('hands back what refused the copy', async () => {
    const { action, store } = buildAction(refusingRepository());

    const outcome = await action.execute('project-1', () => store);

    expect((outcome.videoStoreFailure as DOMException).name).toBe('QuotaExceededError');
  });

  it('hands back nothing when the video was kept', async () => {
    const { action, store } = buildAction(substitute<ProjectRepository>({
      cacheVideoBlob: () => Promise.resolve(),
    }));

    const outcome = await action.execute('project-1', () => store);

    expect(outcome.videoStoreFailure).toBeNull();
  });

  describe('when another video is opened while the project is being established', () => {
    const cached = new Map<string, Blob>();
    const cachingRepository = substitute<ProjectRepository>({
      cacheVideoBlob: (id: string, blob: Blob) => {
        cached.set(id, blob);
        return Promise.resolve();
      },
      delete: (id: string) => {
        cached.delete(id);
        return Promise.resolve();
      },
    });

    const openAnotherVideoMidway = async () => {
      cached.clear();
      const { action, store } = buildAction(cachingRepository);
      const establishing = action.execute('project-1', () => store);
      const other = new File(['other frames'], 'other.mp4', { type: 'video/mp4' });
      store.reset({ video: { file: other, fileName: other.name } });
      await establishing;
      return { store, other };
    };

    it('leaves the newly opened video without the project', async () => {
      const { store, other } = await openAnotherVideoMidway();

      expect(store.snapshot().video.file).toBe(other);
      expect(store.snapshot().projectId).toBeNull();
    });

    it('drops the copy it kept for the project that was not established', async () => {
      await openAnotherVideoMidway();

      expect(cached.size).toBe(0);
    });
  });

  it('stamps the project where the session went while the project was being established', async () => {
    const cached = new Map<string, Blob>();
    const { action, store } = buildAction(substitute<ProjectRepository>({
      cacheVideoBlob: (id: string, blob: Blob) => {
        cached.set(id, blob);
        return Promise.resolve();
      },
    }));
    const sessionElsewhere = new EditorStore();
    sessionElsewhere.restore(store.snapshot());
    let session = store;

    const establishing = action.execute('project-1', () => session);
    session = sessionElsewhere;
    store.reset();
    await establishing;

    expect(sessionElsewhere.snapshot().projectId).toBe('project-1');
    expect(sessionElsewhere.snapshot().projectName).toBe('holiday');
    expect(store.snapshot().projectId).toBeNull();
    expect(cached.size).toBe(1);
  });

  describe('when a saved project starts loading while the project is being established', () => {
    it('leaves the loading project\'s identity in place and keeps no copy', async () => {
      const cached = new Map<string, Blob>();
      const { action, store } = buildAction(substitute<ProjectRepository>({
        cacheVideoBlob: (id: string, blob: Blob) => {
          cached.set(id, blob);
          return Promise.resolve();
        },
        delete: (id: string) => {
          cached.delete(id);
          return Promise.resolve();
        },
      }));

      const establishing = action.execute('project-1', () => store);
      store.patch({ status: 'loading-project' });
      store.patch({ projectId: 'saved-project' });
      await establishing;

      expect(store.snapshot().projectId).toBe('saved-project');
      expect(cached.size).toBe(0);
    });
  });
});
