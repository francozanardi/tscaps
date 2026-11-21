import { describe, expect, it } from 'vitest';
import { BackgroundJobs } from '@mcp/services/BackgroundJobs';

describe('BackgroundJobs', () => {
  it('refuses a second job while one runs, naming the one to wait for, and takes one again once it has ended', async () => {
    const jobs = new BackgroundJobs();
    let finish: (value: unknown) => void = () => undefined;
    const first = await jobs.start('export_video', () => new Promise((resolve) => { finish = resolve; }), 0);
    let secondStarted = false;

    await expect(jobs.start('reframe_video', async () => { secondStarted = true; }, 0)).rejects.toThrow(new RegExp(`busy with ${first.id}.*wait_for_job`));
    expect(secondStarted).toBe(false);
    expect(jobs.runningJob()).toBe(first.id);

    finish('done');
    expect(await jobs.wait(first.id, 1000)).toMatchObject({ state: 'done', result: 'done' });
    expect(jobs.runningJob()).toBeNull();
    expect((await jobs.start('reframe_video', async () => 'framed', 1000)).state).toMatchObject({ state: 'done', result: 'framed' });
  });
});
