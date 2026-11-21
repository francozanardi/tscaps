import type { AutomationAnswer, AutomationFailure } from '@core/automation/domain/AutomationAnswer';
import type { AutomationCall } from '@core/automation/domain/AutomationCall';
import type { AutomationChannel } from '@core/automation/domain/AutomationChannel';
import type { AutomationMethod } from '@core/automation/domain/AutomationMethod';

/**
 * Answers every call that comes in over the channel with the method it
 * names. Calls run one at a time, in arrival order, so two edits never
 * interleave. A method that rejects, or a name no method has, becomes a
 * failed answer; nothing a caller sends can stop the dispatcher.
 */
export class AutomationDispatcher {
  private readonly byName = new Map<string, AutomationMethod>();
  private queue: Promise<void> = Promise.resolve();

  /** Throws when two methods share a name: that is a wiring mistake. */
  constructor(
    private readonly channel: AutomationChannel,
    methods: ReadonlyArray<AutomationMethod>,
  ) {
    for (const method of methods) {
      if (this.byName.has(method.name)) throw new Error(`Two automation methods are named ${method.name}`);
      this.byName.set(method.name, method);
    }
  }

  /** Starts answering. Call once. */
  start(): void {
    this.channel.listen((call) => {
      this.queue = this.queue.then(() => this.handle(call));
    });
  }

  private async handle(call: AutomationCall): Promise<void> {
    const answer = await this.answerTo(call);
    try {
      await this.channel.answer(answer);
    } catch (error) {
      // The program went away; there is nobody left to tell.
      console.warn('Could not deliver an automation answer', error);
    }
  }

  private async answerTo(call: AutomationCall): Promise<AutomationAnswer> {
    const method = this.byName.get(call.method);
    if (method === undefined) {
      const known = [...this.byName.keys()].join(', ');
      return { id: call.id, ok: false, error: { name: 'AutomationCallFailedError', message: `No method is named ${call.method}. Known: ${known}.` } };
    }
    try {
      return { id: call.id, ok: true, result: await method.run(call.params) };
    } catch (error) {
      return { id: call.id, ok: false, error: this.describe(error) };
    }
  }

  private describe(error: unknown): AutomationFailure {
    if (!(error instanceof Error)) return { name: 'Error', message: String(error) };
    const cause = error.cause instanceof Error ? ` (${error.cause.name}: ${error.cause.message})` : '';
    return { name: error.name, message: `${error.message}${cause}` };
  }
}
