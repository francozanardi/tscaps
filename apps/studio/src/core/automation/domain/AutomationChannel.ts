import type { AutomationAnswer } from '@core/automation/domain/AutomationAnswer';
import type { AutomationCall } from '@core/automation/domain/AutomationCall';

/**
 * The page's connection to the program driving it from outside: calls
 * come in, answers go out, a file the program asked for is written to it
 * in pieces, each at its byte offset, so it never has to sit whole in the
 * page.
 */
export interface AutomationChannel {
  /** Starts receiving calls; `onCall` runs once per call, in arrival order. Call once. */
  listen(onCall: (call: AutomationCall) => void): void;
  answer(answer: AutomationAnswer): Promise<void>;
  /**
   * Writes `bytes` at `position` of the file the program named `fileId`.
   * Resolves once the program has them. Writes to one file are made one
   * after the other.
   */
  writeFile(fileId: string, position: number, bytes: Uint8Array<ArrayBuffer>): Promise<void>;
}
