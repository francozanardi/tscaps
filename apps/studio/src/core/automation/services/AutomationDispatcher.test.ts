import { describe, expect, it } from 'vitest';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';
import { AutomationCallFailedError } from '@core/automation/domain/AutomationCallFailedError';
import { AutomationDispatcher } from '@core/automation/services/AutomationDispatcher';
import { InMemoryAutomationChannel } from '@core/automation/testing/InMemoryAutomationChannel';

/** A method that records when it ran and answers its params, after a pause of their choosing. */
class EchoMethod implements AutomationMethod {
  readonly name = 'echo';
  readonly order: string[] = [];

  async run(params: unknown): Promise<unknown> {
    const { text, pauseMs } = params as { text: string; pauseMs: number };
    this.order.push(`start ${text}`);
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
    this.order.push(`end ${text}`);
    return text;
  }
}

class FailingMethod implements AutomationMethod {
  readonly name = 'fail';

  async run(): Promise<unknown> {
    throw new AutomationCallFailedError('fail', 'nothing to do', { cause: new RangeError('out of range') });
  }
}

describe('AutomationDispatcher', () => {
  it('answers each call with its method\'s result, one call at a time in arrival order', async () => {
    const channel = new InMemoryAutomationChannel();
    const echo = new EchoMethod();
    new AutomationDispatcher(channel, [echo]).start();

    channel.send({ id: 1, method: 'echo', params: { text: 'slow', pauseMs: 20 } });
    channel.send({ id: 2, method: 'echo', params: { text: 'fast', pauseMs: 0 } });
    await channel.answersArrived(2);

    expect(channel.answers).toEqual([{ id: 1, ok: true, result: 'slow' }, { id: 2, ok: true, result: 'fast' }]);
    expect(echo.order).toEqual(['start slow', 'end slow', 'start fast', 'end fast']);
  });

  it('answers a failure with the error\'s name, its message and its cause', async () => {
    const channel = new InMemoryAutomationChannel();
    new AutomationDispatcher(channel, [new FailingMethod()]).start();

    channel.send({ id: 7, method: 'fail', params: {} });
    await channel.answersArrived(1);

    expect(channel.answers[0]).toEqual({
      id: 7,
      ok: false,
      error: { name: 'AutomationCallFailedError', message: 'fail: nothing to do (RangeError: out of range)' },
    });
  });

  it('answers a call to a method that does not exist with the names that do, and keeps answering', async () => {
    const channel = new InMemoryAutomationChannel();
    new AutomationDispatcher(channel, [new EchoMethod()]).start();

    channel.send({ id: 1, method: 'nope', params: {} });
    channel.send({ id: 2, method: 'echo', params: { text: 'still here', pauseMs: 0 } });
    await channel.answersArrived(2);

    expect(channel.answers[0]).toMatchObject({ id: 1, ok: false, error: { message: expect.stringContaining('Known: echo') } });
    expect(channel.answers[1]).toEqual({ id: 2, ok: true, result: 'still here' });
  });
});
