import { describe, expect, it } from 'vitest';
import { ListProjectsAction } from '@core/projects/actions/ListProjectsAction';
import { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import type { ProjectRepository } from '@core/projects/domain/ProjectRepository';

function project(id: string, hasDocument: boolean): ProjectMetadata {
  const timestamp = new Date('2026-09-09T12:00:00Z');
  return new ProjectMetadata(
    id,
    id,
    timestamp,
    timestamp,
    {
      fileName: `${id}.mp4`,
      mimeType: 'video/mp4',
      size: 100,
      duration: 10,
    },
    null,
    hasDocument,
  );
}

describe('ListProjectsAction', () => {
  const substitute = <T>(stub: object): T => stub as T;

  it('omits projects whose preprocessing never produced a saved document', async () => {
    const action = new ListProjectsAction(substitute<ProjectRepository>({
      list: async () => [project('finished', true), project('provisional', false)],
    }));

    const projects = await action.execute();

    expect(projects.map(({ id }) => id)).toEqual(['finished']);
  });

  it('also filters a prewarmed project list', async () => {
    const action = new ListProjectsAction(substitute<ProjectRepository>({
      list: async () => [project('provisional', false)],
    }));
    await action.prewarm();

    const projects = await action.execute();

    expect(projects).toEqual([]);
  });
});
