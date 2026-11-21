import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import { PreprocessingRun } from '@core/preprocessing/services/PreprocessingRun';
import { PreprocessingProgressStore } from '@core/preprocessing/store/PreprocessingProgressStore';
import { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import { ProjectListingBuilder } from '@presentation/projects/services/ProjectListingBuilder';

/**
 * A project is stored before its captions are made, and stays without
 * them when its run fails or ends with its tab. The projects page has
 * to tell those apart from the projects a run in this tab is still
 * working on, which it shows with their progress, and from the ones
 * that are finished.
 */

function openVideo(store: EditorStore, name: string): File {
  const file = new File([name], name, { type: 'video/mp4' });
  store.reset({ video: { file, fileName: name, mimeType: file.type, size: file.size, duration: 12 } });
  return file;
}

function storedProject(id: string, hasDocument: boolean): ProjectMetadata {
  const now = new Date();
  return new ProjectMetadata(
    id,
    'Stored',
    now,
    now,
    { fileName: 'stored.mp4', mimeType: 'video/mp4', size: 1, duration: 12 },
    null,
    hasDocument,
    null,
  );
}

function runSaving(store: EditorStore, file: File, projectId: string): PreprocessingRun {
  const run = new PreprocessingRun(store, file, new PreprocessingProgressStore(), projectId);
  store.patch({ projectId, projectName: file.name, projectCreatedAt: new Date() });
  return run;
}

describe('ProjectListingBuilder', () => {
  const builder = new ProjectListingBuilder();

  it('lists the project of a run that is still saving it', () => {
    const store = new EditorStore();
    const run = runSaving(store, openVideo(store, 'clip.mp4'), 'project-1');

    const { inProgress } = builder.build([run], []);

    expect(inProgress).toHaveLength(1);
    expect(inProgress[0]?.project).toMatchObject({ id: 'project-1', name: 'clip.mp4', hasDocument: false });
    expect(inProgress[0]?.openable).toBe(true);
  });

  it('tells how far the run working on a project is', () => {
    const store = new EditorStore();
    const run = runSaving(store, openVideo(store, 'clip.mp4'), 'project-1');
    run.progress.start('audio-extract');
    run.progress.setInferringProgress(0.4);

    const [entry] = builder.build([run], []).inProgress;

    expect(entry?.progress).toMatchObject({ phase: 'inferring', rawProgress: 0.4 });
  });

  it('lists nothing in progress for a run that has no project yet', () => {
    const store = new EditorStore();
    const run = new PreprocessingRun(store, openVideo(store, 'clip.mp4'), new PreprocessingProgressStore(), 'project-1');

    expect(builder.build([run], []).inProgress).toEqual([]);
  });

  it('lists a project as stored, and no longer in progress, once the store has it finished', () => {
    const store = new EditorStore();
    const run = runSaving(store, openVideo(store, 'clip.mp4'), 'project-1');

    const listing = builder.build([run], [storedProject('project-1', true)]);

    expect(listing.inProgress).toEqual([]);
    expect(listing.stored.map((project) => project.id)).toEqual(['project-1']);
  });

  it('keeps a project in progress while a run in this tab still works on it, though the store has it unfinished', () => {
    const store = new EditorStore();
    const run = runSaving(store, openVideo(store, 'clip.mp4'), 'project-1');

    const listing = builder.build([run], [storedProject('project-1', false), storedProject('project-2', true)]);

    expect(listing.inProgress.map((entry) => entry.project.id)).toEqual(['project-1']);
    expect(listing.stored.map((project) => project.id)).toEqual(['project-2']);
  });

  it('lists a stored project with no document and no run among the stored ones, as unfinished', () => {
    const listing = builder.build([], [storedProject('project-1', false), storedProject('project-2', true)]);

    expect(listing.inProgress).toEqual([]);
    expect(listing.stored.map((project) => [project.id, project.hasDocument])).toEqual([
      ['project-1', false],
      ['project-2', true],
    ]);
  });

  it('keeps listing the project once another video is opened, without offering to open it', () => {
    const store = new EditorStore();
    const run = runSaving(store, openVideo(store, 'first.mp4'), 'project-1');

    openVideo(store, 'second.mp4');
    const [entry] = builder.build([run], []).inProgress;

    expect(entry?.project).toMatchObject({ id: 'project-1', name: 'first.mp4' });
    expect(entry?.openable).toBe(false);
  });

  it('lists a project two runs work on once, as the run whose session the editor shows', () => {
    const store = new EditorStore();
    const failed = runSaving(store, openVideo(store, 'clip.mp4'), 'project-1');
    store.patch({ status: 'loading-project' });
    const reopened = openVideo(store, 'clip.mp4');
    const again = runSaving(store, reopened, 'project-1');

    const { inProgress } = builder.build([failed, again], [storedProject('project-1', false)]);

    expect(inProgress).toHaveLength(1);
    expect(inProgress[0]?.openable).toBe(true);
  });
});
