import type { AppError } from '@core/errors/domain/AppError';
import type { UnreadableVideoPositionReader } from '@core/errors/domain/UnreadableVideoPositionReader';
import type { TelemetryEventProperties } from '@shared/telemetry';

const MAX_LINKS = 8;
const MAX_MESSAGE_CHARS = 500;
const CHAIN_SEPARATOR = ' -> ';
const BRANCH_SEPARATOR = ' | ';

/**
 * Turns an `AppError` into the property bag every telemetry site uses
 * to describe a failure.
 *
 * The outer name/message and the immediate cause pair travel as
 * separate fields — they carry the primary groupings dashboards
 * already filter on. `error_chain` joins every link of the cause
 * chain as `Name: message` fragments, so a failure whose real reason
 * is nested several wrappers deep still tells its full story from a
 * single event without adding a field per level. An `AggregateError`
 * has no single reason: its branches are rendered together inside
 * brackets, because a step that tried several strategies is only
 * diagnosable when every attempt's failure is readable at once.
 *
 * The rendering is capped at MAX_LINKS errors in total — across the
 * chain and every branch — and guards against a cause that points
 * back into what it came from; each message is truncated at
 * MAX_MESSAGE_CHARS. Together those keep the joined field well
 * within the per-property size caps telemetry backends enforce even
 * under pathological chains.
 *
 * `video_unreadable_from_s` is the second a video stopped decoding at
 * when that is what the failure comes down to, and `null` otherwise:
 * the one place a damaged source can be found from without the file.
 */
export class AppErrorTelemetryDescriber {
  constructor(private readonly unreadableVideoPositionReader: UnreadableVideoPositionReader) {}

  describe(appError: AppError): TelemetryEventProperties {
    const cause = appError.cause;
    return {
      error_name: appError.name,
      error_message: appError.message,
      error_cause_name: cause instanceof Error ? cause.name : null,
      error_cause_message: cause instanceof Error ? cause.message : null,
      error_chain: this.render(appError, new Set<Error>()),
      video_unreadable_from_s: this.unreadableVideoPositionReader.positionIn(appError),
    };
  }

  private render(error: Error, rendered: Set<Error>): string {
    rendered.add(error);
    const head = this.formatLink(error);
    if (rendered.size >= MAX_LINKS) return head;
    const branches = this.branchesOf(error);
    if (branches.length > 0) return this.renderBranches(head, branches, rendered);
    const cause = (error as { cause?: unknown }).cause;
    if (!(cause instanceof Error) || rendered.has(cause)) return head;
    return head + CHAIN_SEPARATOR + this.render(cause, rendered);
  }

  private renderBranches(head: string, branches: Error[], rendered: Set<Error>): string {
    const parts = branches
      .filter((branch) => !rendered.has(branch))
      .map((branch) => this.render(branch, rendered));
    if (parts.length === 0) return head;
    return `${head} [${parts.join(BRANCH_SEPARATOR)}]`;
  }

  private branchesOf(error: Error): Error[] {
    const branches = (error as { errors?: unknown }).errors;
    if (!Array.isArray(branches)) return [];
    return branches.filter((branch): branch is Error => branch instanceof Error);
  }

  private formatLink(error: Error): string {
    const message = error.message.length > MAX_MESSAGE_CHARS
      ? error.message.slice(0, MAX_MESSAGE_CHARS) + '...'
      : error.message;
    return `${error.name}: ${message}`;
  }
}
