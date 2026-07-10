import { WhisperTranscriber, PreDecodedAudioDecoder, type WhisperTranscriberConfig } from '@tscaps/engine';
import { TranscriberWorkerHost } from '@core/transcription/infrastructure/workers/TranscriberWorkerHost';

self.addEventListener('error', (e: ErrorEvent) => {
  console.error('[whisper worker] uncaught error', e.message, e.filename + ':' + e.lineno, e.error);
});
self.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  console.error('[whisper worker] unhandled rejection', e.reason);
});

new TranscriberWorkerHost(
  (config) => new WhisperTranscriber(new PreDecodedAudioDecoder(), config as WhisperTranscriberConfig | undefined),
).start();
