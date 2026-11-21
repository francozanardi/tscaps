import type { AutomationAnswer } from '@core/automation/domain/AutomationAnswer';
import type { AutomationCall } from '@core/automation/domain/AutomationCall';
import type { AutomationChannel } from '@core/automation/domain/AutomationChannel';

/**
 * An automation channel held in memory, for tests: calls are delivered
 * with `send`, answers are kept in order, and every file written is
 * rebuilt from its pieces as the program would write it to disk.
 */
export class InMemoryAutomationChannel implements AutomationChannel {
  readonly answers: AutomationAnswer[] = [];
  /** Every `writeFile`, in order: which file, where, and how many bytes. */
  readonly writes: Array<{ fileId: string; position: number; length: number }> = [];
  private readonly files = new Map<string, Uint8Array>();
  private onCall: ((call: AutomationCall) => void) | null = null;
  private answered: Array<() => void> = [];

  listen(onCall: (call: AutomationCall) => void): void {
    this.onCall = onCall;
  }

  send(call: AutomationCall): void {
    this.onCall?.(call);
  }

  async answer(answer: AutomationAnswer): Promise<void> {
    this.answers.push(answer);
    for (const waiter of this.answered.splice(0)) waiter();
  }

  /** Resolves once `count` answers have arrived. */
  async answersArrived(count: number): Promise<void> {
    while (this.answers.length < count) await new Promise<void>((resolve) => this.answered.push(resolve));
  }

  async writeFile(fileId: string, position: number, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    this.writes.push({ fileId, position, length: bytes.byteLength });
    const existing = this.files.get(fileId) ?? new Uint8Array(0);
    const grown = new Uint8Array(Math.max(existing.byteLength, position + bytes.byteLength));
    grown.set(existing, 0);
    grown.set(bytes, position);
    this.files.set(fileId, grown);
  }

  /** The file as written so far; empty when nothing was. */
  file(fileId: string): Uint8Array {
    return this.files.get(fileId) ?? new Uint8Array(0);
  }
}
