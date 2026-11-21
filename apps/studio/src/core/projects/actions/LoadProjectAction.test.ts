import { describe, expect, it, vi } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { LoadProjectAction } from '@core/projects/actions/LoadProjectAction';
import { Project } from '@core/projects/domain/Project';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';
import type { VideoBlobLookup } from '@core/videos/domain/VideoBlobLookup';

/**
 * A proxy on its own is not a project that can be opened. Opening on a
 * cached proxy whose source video is gone put the reader in an editor
 * that could not export, with the only way out — picking the file
 * again — hidden behind a background download that could only fail.
 *
 * Nor is a project whose shots name files it cannot show yet: the
 * editor opens only once the proxies of those files are settled.
 */

const PROJECT = Project.fromVideo('Beach', { fileName: 'beach.mp4', mimeType: 'video/mp4', size: 10, duration: 5 });

function repositoryHolding(video: boolean): ProjectRepository {
  const lookup: VideoBlobLookup = video
    ? { outcome: 'found', blob: new Blob(['frames']), source: 'device' }
    : { outcome: 'missing', reason: 'absent' };
  return {
    load: () => Promise.resolve(PROJECT),
    hasVideoSource: () => Promise.resolve(video),
    loadVideoBlob: () => Promise.resolve(lookup),
  } as Partial<ProjectRepository> as ProjectRepository;
}

const idle = { reset: () => {}, start: () => {}, markReady: () => {}, setProgress: () => {}, report: () => {} };

const LOADED_AT_ONCE = { execute: () => Promise.resolve() };

function loaderOver(
  repository: ProjectRepository,
  store = new EditorStore(),
  mediaLoader: object = LOADED_AT_ONCE,
): LoadProjectAction {
  const stub = <T>(value: object): T => value as T;
  return new LoadProjectAction(
    store,
    stub(idle),
    stub(idle),
    stub(idle),
    repository,
    stub({ execute: () => {} }),
    stub({ isSupported: () => true }),
    stub({ subscribe: () => () => {} }),
    stub({ fromRepository: () => Promise.resolve({ blob: new Blob(['proxy']), mimeType: 'video/mp4', widthPx: 1, heightPx: 1 }) }),
    stub({ execute: () => Promise.resolve() }),
    stub({ check: () => Promise.resolve() }),
    stub({ substitute: (project: Project) => Promise.resolve(project) }),
    stub({ clamp: (name: string) => name }),
    stub({ reportOpened: () => {}, reportVideoRecoveryOffered: () => {}, reportFailed: () => {}, reportBlockedByTemplates: () => {} }),
    stub(mediaLoader),
  );
}

describe('opening a project with a cached proxy', () => {
  it('asks for the video again when the proxy has outlived it', async () => {
    const result = await loaderOver(repositoryHolding(false)).execute(PROJECT.id);

    expect(result.kind).toBe('video-missing');
  });

  it('opens on the proxy when the video can be had', async () => {
    const result = await loaderOver(repositoryHolding(true)).execute(PROJECT.id);

    expect(result.kind).toBe('opened');
  });

  it('stays loading until the media files the shots use are ready', async () => {
    const store = new EditorStore();
    let settle: () => void = () => {};
    const loader = { execute: () => new Promise<void>((resolve) => { settle = resolve; }) };

    const opening = loaderOver(repositoryHolding(true), store, loader).execute(PROJECT.id);
    await vi.waitFor(() => expect(store.snapshot().status).toBe('loading-project'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.snapshot().status).toBe('loading-project');

    settle();

    expect((await opening).kind).toBe('opened');
    expect(store.snapshot().status).toBe('idle');
  });
});
