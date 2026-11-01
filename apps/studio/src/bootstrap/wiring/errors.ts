import type { ErrorReporter } from '@core/errors/domain/ErrorReporter';
import { CompositeErrorReporter } from '@core/errors/infrastructure/CompositeErrorReporter';
import { ConsoleErrorReporter } from '@core/errors/infrastructure/ConsoleErrorReporter';
import { AppErrorClassifier } from '@core/errors/services/AppErrorClassifier';
import { AppErrorTelemetryDescriber } from '@core/errors/services/AppErrorTelemetryDescriber';
import { AppNoticeChannel } from '@core/errors/services/AppNoticeChannel';
import { FailureReasonResolver } from '@core/errors/services/FailureReasonResolver';
import { CauseChainUnreadableVideoPositionReader } from '@core/errors/services/CauseChainUnreadableVideoPositionReader';
import type { UnreadableVideoPositionReader } from '@core/errors/domain/UnreadableVideoPositionReader';
import { BackendUnavailableFailureReasonRule } from '@core/errors/services/failure-reasons/BackendUnavailableFailureReasonRule';
import { NetworkUnreachableFailureReasonRule } from '@core/errors/services/failure-reasons/NetworkUnreachableFailureReasonRule';
import { NotFoundFailureReasonRule } from '@core/errors/services/failure-reasons/NotFoundFailureReasonRule';
import { StorageFullFailureReasonRule } from '@core/errors/services/failure-reasons/StorageFullFailureReasonRule';
import { UnreadablePartwayFailureReasonRule } from '@core/errors/services/failure-reasons/UnreadablePartwayFailureReasonRule';
import { UnsupportedCodecFailureReasonRule } from '@core/errors/services/failure-reasons/UnsupportedCodecFailureReasonRule';
import { WorkerErrorMonitor } from '@core/_shared/workers/WorkerErrorMonitor';

export interface ErrorsModule {
  readonly errorReporter: ErrorReporter;
  readonly workerErrorMonitor: WorkerErrorMonitor;
  readonly errorClassifier: AppErrorClassifier;
  readonly errorTelemetryDescriber: AppErrorTelemetryDescriber;
  readonly failureReasonResolver: FailureReasonResolver;
  readonly unreadableVideoPositionReader: UnreadableVideoPositionReader;
  readonly appNoticeChannel: AppNoticeChannel;
}

/**
 * Boots the errors feature: the three destinations a failure can take
 * and the vocabulary every feature describes one with.
 *
 * Every build reports crashes to the console; a build with a reporting
 * backend configured also sends the report there. The composite hides
 * which channels are active behind one port.
 *
 * Most of the main thread never needs it — the reporting SDK's global
 * handlers already cover anything that propagates. What reaches this
 * port is what those handlers cannot see: a worker's unhandled
 * rejection, and a failure some `catch` recovered from without anybody
 * upstream ever learning it happened.
 *
 * Rules are listed most specific first — the resolver takes the first
 * match, so their order is the tie-break when one failure could be
 * described by two conditions.
 *
 * Boots before every feature module: the notice channel and the
 * classifier are dependencies of the wirings that own the operations
 * able to fail, not of the editor that happens to render them.
 */
export function bootErrors(): ErrorsModule {
  const reporters: ErrorReporter[] = [new ConsoleErrorReporter()];
  const errorReporter = new CompositeErrorReporter(reporters);
  const unreadableVideoPositionReader = new CauseChainUnreadableVideoPositionReader();
  return {
    errorReporter,
    workerErrorMonitor: new WorkerErrorMonitor(errorReporter),
    errorClassifier: new AppErrorClassifier(),
    errorTelemetryDescriber: new AppErrorTelemetryDescriber(unreadableVideoPositionReader),
    unreadableVideoPositionReader,
    appNoticeChannel: new AppNoticeChannel(),
    failureReasonResolver: new FailureReasonResolver([
      new NotFoundFailureReasonRule(),
      new StorageFullFailureReasonRule(),
      new UnreadablePartwayFailureReasonRule(unreadableVideoPositionReader),
      new UnsupportedCodecFailureReasonRule(),
      new BackendUnavailableFailureReasonRule(),
      new NetworkUnreachableFailureReasonRule(),
    ]),
  };
}

