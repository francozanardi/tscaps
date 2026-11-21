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
    null,
  );
}

describe('ListProjectsAction', () => {
  const substitute = <T>(stub: object): T => stub as T;

  it('lists unfinished projects along with the finished ones, each saying whether it has a document', async () => {
    const action = new ListProjectsAction(substitute<ProjectRepository>({
      list: async () => [project('finished', true), project('unfinished', false)],
    }));

    const projects = await action.execute();

    expect(projects.map(({ id, hasDocument }) => [id, hasDocument])).toEqual([
      ['finished', true],
      ['unfinished', false],
    ]);
  });

  it('answers the first call after a prewarm with the prewarmed list, and later calls with a fresh one', async () => {
    let listed = 0;
    const action = new ListProjectsAction(substitute<ProjectRepository>({
      list: async () => {
        listed += 1;
        return [project(`list-${listed}`, false)];
      },
    }));
    await action.prewarm();

    const first = await action.execute();
    const second = await action.execute();

    expect(first.map(({ id }) => id)).toEqual(['list-1']);
    expect(second.map(({ id }) => id)).toEqual(['list-2']);
  });
});
