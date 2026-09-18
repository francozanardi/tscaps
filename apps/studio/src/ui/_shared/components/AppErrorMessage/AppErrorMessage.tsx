import type { ReactElement } from 'react';
import type { AppError } from '@core/errors/domain/AppError';
import type { FailureReason } from '@core/errors/domain/FailureReason';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';
import { useErrors } from '@ui/_shared/contexts/modules/ErrorsContext';
import { SUPPORT_EMAIL } from '@ui/_shared/supportEmail';
import type { UnsupportedAudioCodecError } from '@core/videos/domain/errors/UnsupportedAudioCodecError';
import type { UnsupportedVideoCodecError } from '@core/videos/domain/errors/UnsupportedVideoCodecError';
import type { ProjectVideoStoreFailedError } from '@core/projects/domain/errors/ProjectVideoStoreFailedError';
import type { OriginalVideoUnavailableError } from '@core/videos/domain/errors/OriginalVideoUnavailableError';

/** Whether a body's bullets are attempts at a fix or places to look. */
type SuggestionKind = 'try' | 'check';

/**
 * Why the reader would write to support. `stuck` is the failure that
 * resisted every remedy offered; `mistake` is the one that offered
 * none because nothing is broken, and only the reader can know that
 * the answer it gave is wrong.
 */
type SupportKind = 'stuck' | 'mistake';

/**
 * What actually frees space, in the order most likely to work. The
 * browser refuses the write long before the disk is literally full,
 * so "delete something" is not enough on its own.
 */
const STORAGE_RECOVERY_BULLETS: readonly string[] = [
  'Free up disk space on your device, then reload the page.',
  'If you are in a private or incognito window, open tscaps in a regular one. Private windows get a much smaller storage allowance.',
  'Clear site data for sites you no longer use.',
];

interface AppErrorMessageProps {
  readonly error: AppError;
  readonly isMobile?: boolean;
}

/**
 * Returns a short, surface-agnostic title describing the failure
 * mode of an `AppError`. Suitable for the header of a dialog or
 * the heading of an inline banner. Unknown error names collapse to
 * a generic title so the UI never goes blank.
 */
export function getAppErrorTitle(error: AppError): string {
  switch (error.name) {
    case 'UnknownAppError':                  return 'Something went wrong';
    case 'ProjectSaveFailedError':           return "Couldn't save your project";
    case 'ProjectVideoStoreFailedError':     return "Couldn't save your video in this browser";
    case 'ExportFailedError':                return "Your video export didn't finish";
    case 'VideoExportUnsupportedError':      return "Your browser can't export videos";
    case 'ProjectListLoadFailedError':       return "Couldn't load your projects";
    case 'ProjectDeleteFailedError':         return "Couldn't delete this project";
    case 'ProjectOpenFailedError':           return "Couldn't open this project";
    case 'OriginalVideoDownloadFailedError': return "Couldn't get your original video";
    case 'OriginalVideoUnavailableError':    return "Couldn't find your original video";
    case 'ProjectExportFailedError':         return "Couldn't export this project";
    case 'ProjectImportFailedError':         return "Couldn't import this project";
    case 'AudioExtractionFailedError':       return "Couldn't read this video's audio";
    case 'BehindActorMeasurementFailedError': return "Couldn't measure where the person is";
    case 'LocalTranscriptionFailedError':    return "On-device transcription didn't finish";
    case 'TranscriptionModelCacheFailedError': return "Couldn't save the transcription model";
    case 'PreviewProxyGenerationFailedError': return "Couldn't build the precise preview";
    case 'PreviewLoadFailedError':           return "Couldn't load this video's preview";
    case 'UnsupportedVideoCodecError':       return "This video can't play in your browser";
    case 'VideoTrackMissingError':           return "This file doesn't have a video track";
    case 'UnsupportedAudioCodecError':       return "This video's audio can't play in your browser";
    case 'VideoDurationUnreadableError':     return "Couldn't read this video's length";
    default: {
      const _: never = error.name;
      return _;
    }
  }
}

/**
 * Names the condition behind a failure so copy can refine on it.
 *
 * An error's name says which operation failed; this says what stopped
 * it. Most entries below need only the first and ignore the result.
 */
export function useFailureReason(error: AppError): FailureReason {
  const { failureReasonResolver } = useErrors();
  return failureReasonResolver.resolve(error);
}

/**
 * Whether this session's original video travels from the server. The
 * two ways it can fail to arrive have nothing in common: a transfer
 * that did not finish, against a browser database that would not
 * answer. Neither remedy helps with the other.
 */
function useOriginalVideoComesFromServer(): boolean {
  return false;
}

/**
 * One-line description of an `AppError` for space-constrained
 * surfaces (toasts, chips, tooltips). Full remediation guidance
 * lives in {@link AppErrorMessage}; this hook hands back a plain
 * string so it can sit inside a single line of chrome.
 */
export function useAppErrorShortDescription(error: AppError): string {
  const reason = useFailureReason(error);
  const originalFromServer = useOriginalVideoComesFromServer();
  switch (error.name) {
    case 'UnknownAppError':                  return 'Try again.';
    case 'ProjectSaveFailedError':           return describeSaveFailure(reason);
    case 'ProjectVideoStoreFailedError':     return describeVideoStoreFailure(error as ProjectVideoStoreFailedError, reason);
    case 'ExportFailedError':                return 'The export was interrupted before it finished.';
    case 'VideoExportUnsupportedError':      return "This browser doesn't have a video encoder.";
    case 'ProjectListLoadFailedError':       return 'Reload the page to try again.';
    case 'ProjectDeleteFailedError':         return 'Try deleting it again.';
    case 'ProjectOpenFailedError':           return describeProjectOpenFailure(reason);
    case 'OriginalVideoDownloadFailedError': return describeOriginalVideoDownloadFailure(originalFromServer);
    case 'OriginalVideoUnavailableError':    return describeOriginalVideoUnavailable(error as OriginalVideoUnavailableError);
    case 'ProjectExportFailedError':         return "Something went wrong while packaging your project.";
    case 'ProjectImportFailedError':         return "The file couldn't be read as a tscaps export.";
    case 'AudioExtractionFailedError':       return describeAudioExtractionFailure(reason);
    case 'LocalTranscriptionFailedError':    return describeLocalTranscriptionFailure(reason);
    case 'TranscriptionModelCacheFailedError': return describeModelCacheFailure(reason);
    case 'BehindActorMeasurementFailedError': return 'Some parts of the video were not measured, so the captions were not placed behind the person there.';
    case 'PreviewProxyGenerationFailedError': return describeProxyFailure(reason);
    case 'PreviewLoadFailedError':           return "The video couldn't be loaded into the editor.";
    case 'UnsupportedVideoCodecError':       return "Your browser can't decode this video's format.";
    case 'VideoTrackMissingError':           return "This file has no video track, so there is nothing to burn the captions into.";
    case 'UnsupportedAudioCodecError':       return "Your browser can't decode this video's audio.";
    case 'VideoDurationUnreadableError':     return 'Playback and scrubbing may be limited. Adding the file again usually fixes it.';
    default: {
      const _: never = error.name;
      return _;
    }
  }
}

/**
 * Each describer enumerates only the reasons that can meaningfully
 * arise for the operation it names, and falls back to the generic copy
 * for everything else. Exhaustiveness on the full `FailureReason` union
 * would force every describer to spell out every reason — including
 * combinations that are unreachable (a transcription-backend condition
 * cannot cause a save or a proxy failure) — and drown the useful
 * branches in dead ones every time the union grows.
 */

function describeSaveFailure(reason: FailureReason): string {
  switch (reason) {
    case 'storage-full': return 'Your device is out of space. Your unsaved work is only in this open editor and will be lost if you leave or reload. Free some space, then save again.';
    default:             return 'Your unsaved work is only in this open editor and will be lost if you leave or reload. Save again.';
  }
}

/**
 * The video is on screen and works, so the loss is entirely in the
 * future, and what the next open has to do is the whole message.
 */
function describeVideoStoreFailure(error: ProjectVideoStoreFailedError, reason: FailureReason): string {
  const cause = reason === 'storage-full' ? 'Your device is out of space. ' : '';
  const nextOpen = error.hasRemoteCopy
    ? 'Next time you open this project, the video will download again.'
    : 'Next time you open this project, you will have to select the video file again.';
  return `${cause}${nextOpen}`;
}

// Which copies came up empty is a question for telemetry: no answer
// to it changes what the reader does next.
function describeOriginalVideoUnavailable(error: OriginalVideoUnavailableError): string {
  return error.hasRemoteCopy
    ? 'Check your connection, save your work, and reload the page.'
    : 'Your browser no longer has the video file. Select it again to export.';
}

function describeProjectOpenFailure(reason: FailureReason): string {
  switch (reason) {
    case 'storage-full':      return 'Your device is out of space. Free some up, then try again.';
    case 'codec-unsupported': return "Your browser can't decode this project's video.";
    case 'not-found':         return "We didn't find this project.";
    default:                  return 'Reload the page to try again.';
  }
}

/**
 * Says nothing about why the transfer stopped. A connection is worth
 * naming as the thing to check and never as the cause: what the code
 * knows is that the bytes did not arrive.
 */
function describeOriginalVideoDownloadFailure(fromServer: boolean): string {
  return fromServer
    ? 'Check your internet connection, then open the project again.'
    : 'Close any other tab with tscaps open, then open the project again.';
}

/**
 * The video plays either way, through the browser's own player when
 * there is no proxy. What that costs is where a cut lands, so the
 * copy says that and never speed. The title names the thing that
 * could not be built, because the drift makes no sense on its own.
 */
function describeProxyFailure(reason: FailureReason): string {
  const consequence = 'The video plays normally, but cuts can end a frame or two late.';
  switch (reason) {
    case 'storage-full':      return `Your device is out of space. ${consequence}`;
    case 'codec-unsupported': return `Your browser can't process this video's format. ${consequence}`;
    default:                  return consequence;
  }
}

function describeAudioExtractionFailure(reason: FailureReason): string {
  switch (reason) {
    case 'codec-unsupported': return "Your browser can't process this video's audio format.";
    default:                  return "We couldn't read the audio from this video.";
  }
}

function describeModelCacheFailure(reason: FailureReason): string {
  switch (reason) {
    case 'storage-full': return 'Your device is out of space, so your next video will download it again.';
    default:             return 'Your next video will download it again.';
  }
}


function describeLocalTranscriptionFailure(reason: FailureReason): string {
  switch (reason) {
    case 'backend-unavailable':  return "The transcribe backend you picked isn't usable on this device. Switch it in Advanced settings.";
    case 'network-unreachable':  return 'The speech model could not be downloaded. Check your internet connection.';
    default:                     return "On-device transcription couldn't finish.";
  }
}

/**
 * Whether a notice about this error has to wait for the reader to
 * dismiss it.
 *
 * Nothing in the app keeps a history of notices, so one that times
 * out unread is unrecoverable: whoever stepped away can never find
 * out why something now behaves differently. Waiting is therefore
 * the default, and fading away is what needs justifying — it fits a
 * failure that asks nothing of the reader, now or later.
 */
export function requiresManualDismissal(error: AppError): boolean {
  switch (error.name) {
    // Cuts drift by a frame in the preview until the next reload
    // tries again. Nothing to do about it, and nothing to remember.
    case 'PreviewProxyGenerationFailedError': return false;
    // Worth holding only when the reader will have to find the file
    // themselves. When the video downloads on its own, they never
    // learn this happened, and nothing is lost by that.
    case 'ProjectVideoStoreFailedError': return !(error as ProjectVideoStoreFailedError).hasRemoteCopy;
    default: return true;
  }
}

/**
 * Renders the body text for an `AppError` — what happened, what the
 * user can try, and how to reach support. The title is intentionally
 * not included; surfaces compose it via `getAppErrorTitle` so they
 * can place it in their own header style.
 */
export function AppErrorMessage({ error, isMobile = false }: AppErrorMessageProps): ReactElement {
  const reason = useFailureReason(error);
  const originalFromServer = useOriginalVideoComesFromServer();
  switch (error.name) {
    case 'UnknownAppError':                  return <GenericFailureBody isMobile={isMobile} />;
    case 'ProjectSaveFailedError':           return <ProjectSaveFailedBody reason={reason} />;
    case 'ProjectVideoStoreFailedError':     return <ProjectVideoStoreFailedBody error={error as ProjectVideoStoreFailedError} reason={reason} />;
    case 'ExportFailedError':                return <ExportFailedBody isMobile={isMobile} />;
    case 'VideoExportUnsupportedError':      return <VideoExportUnsupportedBody isMobile={isMobile} />;
    case 'ProjectListLoadFailedError':       return <ProjectListLoadFailedBody />;
    case 'ProjectDeleteFailedError':         return <ProjectDeleteFailedBody />;
    case 'ProjectOpenFailedError':           return <ProjectOpenFailedBody reason={reason} isMobile={isMobile} />;
    case 'OriginalVideoDownloadFailedError': return <OriginalVideoDownloadFailedBody fromServer={originalFromServer} />;
    case 'OriginalVideoUnavailableError':    return <OriginalVideoUnavailableBody error={error as OriginalVideoUnavailableError} />;
    case 'ProjectExportFailedError':         return <ProjectExportFailedBody />;
    case 'ProjectImportFailedError':         return <ProjectImportFailedBody />;
    case 'AudioExtractionFailedError':       return <AudioExtractionFailedBody reason={reason} isMobile={isMobile} />;
    case 'LocalTranscriptionFailedError':    return <LocalTranscriptionFailedBody reason={reason} isMobile={isMobile} />;
    case 'TranscriptionModelCacheFailedError': return <TranscriptionModelCacheFailedBody reason={reason} />;
    case 'BehindActorMeasurementFailedError': return <BehindActorMeasurementFailedBody />;
    case 'PreviewProxyGenerationFailedError': return <PreviewProxyGenerationFailedBody reason={reason} />;
    case 'PreviewLoadFailedError':           return <PreviewLoadFailedBody isMobile={isMobile} />;
    case 'UnsupportedVideoCodecError':       return <UnsupportedVideoCodecBody error={error as UnsupportedVideoCodecError} isMobile={isMobile} />;
    case 'VideoTrackMissingError':           return <VideoTrackMissingBody />;
    case 'UnsupportedAudioCodecError':       return <UnsupportedAudioCodecBody error={error as UnsupportedAudioCodecError} isMobile={isMobile} />;
    case 'VideoDurationUnreadableError':     return <VideoDurationUnreadableBody />;
    default: {
      const _: never = error.name;
      return _;
    }
  }
}

/** Notice-only, like {@link ProjectVideoStoreFailedBody}. */
function PreviewProxyGenerationFailedBody({ reason }: { readonly reason: FailureReason }): ReactElement {
  return <p className="m-0">{describeProxyFailure(reason)}</p>;
}

function PreviewLoadFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <ErrorBody
      lead="We couldn't load this video into the editor."
      bullets={['Add the video again in a new project.', ...fallbackBullets]}
    />
  );
}

function UnsupportedVideoCodecBody({
  error,
  isMobile,
}: {
  readonly error: UnsupportedVideoCodecError;
  readonly isMobile: boolean;
}): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <ErrorBody
      lead="Your browser doesn't support this video's format."
      bullets={['Convert the video to MP4 (H.264) and add it again.', ...fallbackBullets]}
      details={`Source codec: ${error.codec}`}
    />
  );
}

/**
 * Nothing here is broken and no remedy applies to the file itself:
 * the reader picked something that is not a video. The second bullet
 * covers the rarer reading — a container whose video track we could
 * not find at all.
 */
function VideoTrackMissingBody(): ReactElement {
  return (
    <ErrorBody
      lead="This file has no video track, so there is nothing to burn the captions into."
      bullets={[
        'Check your video file.',
        'If this really is a video, try converting it to MP4 (H.264) and add it again.',
      ]}
      support="mistake"
    />
  );
}

/**
 * The dead end that no file and no setting recovers from: the browser
 * itself cannot encode video. Says so plainly, so the reader does not
 * spend the evening converting a file that was never the problem.
 */
function VideoExportUnsupportedBody({ isMobile }: { readonly isMobile: boolean }): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <ErrorBody
      lead="This browser has no video encoder."
      bullets={['Update your browser to its latest version.', ...fallbackBullets]}
    />
  );
}

function UnsupportedAudioCodecBody({
  error,
  isMobile,
}: {
  readonly error: UnsupportedAudioCodecError;
  readonly isMobile: boolean;
}): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <ErrorBody
      lead="Your browser can't process this video's audio."
      bullets={['Convert the audio to AAC or Opus and add it again.', ...fallbackBullets]}
      details={`Source codec: ${error.codec}`}
    />
  );
}

function AudioExtractionFailedBody({
  reason,
  isMobile,
}: {
  readonly reason: FailureReason;
  readonly isMobile: boolean;
}): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  if (reason === 'codec-unsupported') {
    return (
      <ErrorBody
        lead="Your browser couldn't decode the audio of this video."
        bullets={[
          'Convert the video to MP4 with H.264 video and AAC audio, then add it again.',
          ...fallbackBullets,
        ]}
      />
    );
  }
  return (
    <ErrorBody
      lead="We weren't able to read the audio from this video."
      bullets={['Try a different video.', ...fallbackBullets]}
    />
  );
}

/** Notice-only, like {@link ProjectVideoStoreFailedBody}. */
function BehindActorMeasurementFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="Some parts of the video could not be measured, so the captions were not placed behind the person there. The rest of the export is unaffected."
      bullets={[
        'Export again if you want another attempt at those parts.',
        'Or pick a template that does not place captions behind the person.',
      ]}
    />
  );
}

function VideoDurationUnreadableBody(): ReactElement {
  return (
    <ErrorBody
      lead="Playback and scrubbing may be limited because we couldn't read the video's length."
      bullets={[
        'Add the file again. That usually recovers the length.',
        'Convert the video to MP4 (H.264) and try again.',
      ]}
    />
  );
}


function ProjectSaveFailedBody({ reason }: { readonly reason: FailureReason }): ReactElement {
  if (reason === 'storage-full') {
    return (
      <ErrorBody
        lead="Your device is out of space, so your changes could not be written. Your work is still open in the editor."
        bullets={STORAGE_RECOVERY_BULLETS}
      />
    );
  }
  return (
    <ErrorBody
      lead="We weren't able to save your changes. Your work is still open in the editor."
      bullets={['Try saving again.', 'If it keeps failing, check your internet connection.']}
    />
  );
}

/**
 * Reaches the reader as a notice and nowhere else, so it says its one
 * sentence and stops. Writing a lead, remedies and a support line for
 * a surface that does not render them produces copy that goes stale
 * unread — which is how the version before this one came to describe
 * a preview that had not been slow for months.
 */
function ProjectVideoStoreFailedBody({
  error,
  reason,
}: {
  readonly error: ProjectVideoStoreFailedError;
  readonly reason: FailureReason;
}): ReactElement {
  return <p className="m-0">{describeVideoStoreFailure(error, reason)}</p>;
}

// The title already says it was not found, so the lead says why. It
// does not claim the server still holds the video: reaching it is what
// failed, and a project that truly lost it says so on the next open.
function OriginalVideoUnavailableBody({ error }: { readonly error: OriginalVideoUnavailableError }): ReactElement {
  if (error.hasRemoteCopy) {
    return (
      <ErrorBody
        lead="The video could not be loaded from your project right now."
        bullets={['Check your internet connection.', 'Save your work, then reload the page.']}
      />
    );
  }
  return (
    <ErrorBody
      lead="Your browser no longer has the video file."
      bullets={['Select the same file to export. Your captions and styling are untouched.']}
    />
  );
}

function ExportFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <ErrorBody
      lead="Something went wrong exporting your video."
      bullets={['Keep your tab open and try again.', ...fallbackBullets]}
    />
  );
}

/**
 * Reloading leads and the network hint follows, because a project list
 * does not always come over the network. A browser database that
 * refused to open does not care whether the reader is online, and
 * connection advice was the only thing this said.
 */

function ProjectListLoadFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to load your projects."
      bullets={[
        'Reload the page.',
        'If it keeps failing, check your internet connection.',
      ]}
    />
  );
}

function ProjectDeleteFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to delete this project."
      bullets={[
        'Try deleting it again.',
        'If it keeps failing, check your internet connection.',
      ]}
    />
  );
}

/**
 * Where a project is kept decides what its absence means, and the two
 * readings have no remedy in common: one is a project this browser
 * was never given, the other one the server no longer has.
 */
function useMissingProjectLead(): string {
  return "We didn't find this project in this browser. Projects stay in the browser that created them, so a link to one does not open on another device or in another browser, and clearing site data removes them.";
}

/**
 * The four ways a project refuses to open want four different
 * answers: a project that is not there is not a failure and has no
 * remedy at all, space is recovered outside the app, an undecodable
 * video needs a different file or a different engine, and everything
 * else is worth one reload before support.
 */
function ProjectOpenFailedBody({
  reason,
  isMobile,
}: {
  readonly reason: FailureReason;
  readonly isMobile: boolean;
}): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  const comesFromServer = useOriginalVideoComesFromServer();
  const missingProjectLead = useMissingProjectLead();
  if (reason === 'not-found') {
    return <ErrorBody lead={missingProjectLead} bullets={[]} support="mistake" />;
  }
  if (reason === 'storage-full') {
    return (
      <ErrorBody
        lead="Your device is out of space, so this project could not be loaded. Your other projects are untouched."
        bullets={STORAGE_RECOVERY_BULLETS}
      />
    );
  }
  if (reason === 'codec-unsupported') {
    return (
      <ErrorBody
        lead="Your browser can't decode this project's video."
        bullets={[
          'Convert the video to MP4 (H.264), then start a new project with it.',
          ...fallbackBullets,
        ]}
      />
    );
  }
  const bullets = [
    'Reload the page.',
    ...(comesFromServer ? ['If it keeps failing, check your internet connection.'] : []),
    ...fallbackBullets,
  ];
  return (
    <ErrorBody
      lead="We weren't able to open this project."
      bullets={bullets}
    />
  );
}

/**
 * The captions are safe either way, so the copy leads with what is
 * actually lost — the export — and opening the project again is the
 * only retry there is: the reader has no local file to offer.
 */
function OriginalVideoDownloadFailedBody({ fromServer }: { readonly fromServer: boolean }): ReactElement {
  if (fromServer) {
    return (
      <ErrorBody
        lead="We weren't able to download the original video of this project. Your captions are safe, but exporting needs the video."
        bullets={[
          'Check your internet connection.',
          'Go back to your projects and open this one again.',
        ]}
      />
    );
  }
  return (
    <ErrorBody
      lead="We weren't able to read the original video of this project from your browser's storage. Your captions are safe, but exporting needs the video."
      bullets={[
        'Close any other tab with tscaps open, then reload the page.',
        'Go back to your projects and open this one again.',
      ]}
    />
  );
}

function ProjectExportFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to package this project for export."
      bullets={[]}
    />
  );
}

function ProjectImportFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to read this file."
      bullets={['Make sure the file is a valid .tscaps export.']}
    />
  );
}


function LocalTranscriptionFailedBody({ reason, isMobile }: { reason: FailureReason; isMobile: boolean }): ReactElement {
  if (reason === 'backend-unavailable') return <TranscriptionBackendUnavailableBody />;
  if (reason === 'network-unreachable') return <TranscriptionModelUnreachableBody />;
  return <GenericLocalTranscriptionFailedBody isMobile={isMobile} />;
}

/**
 * The model download never reached a server. No engine-fallback
 * bullets: the browser is not what refused, the network between it and
 * the model is, and the same browser on another network works.
 */
function TranscriptionModelUnreachableBody(): ReactElement {
  return (
    <ErrorBody
      lead="Transcribing on your device needs to download a speech model the first time. That download did not reach the server."
      bullets={[
        'Check your internet connection, then start again.',
        'If you use a VPN, a proxy, or a network filter, it may be blocking the download.',
        'Some networks block the server the model is served from. Trying from another network usually works.',
      ]}
    />
  );
}

function GenericLocalTranscriptionFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <ErrorBody
      lead="In-browser transcription couldn't complete on your device."
      bullets={['Try a shorter video.', ...fallbackBullets]}
    />
  );
}

/**
 * The user picked a transcribe backend the current device can't run.
 * No engine-fallback bullets — the fix is inside the app, not in
 * switching browsers.
 */
function TranscriptionBackendUnavailableBody(): ReactElement {
  return (
    <ErrorBody
      lead="The transcribe backend you picked isn't usable on this device."
      bullets={[
        'Open Advanced settings on the transcribe screen and switch the backend to CPU, then start again.',
        'If you picked GPU, WebGPU support depends on your OS, GPU, and browser build.',
      ]}
    />
  );
}

/**
 * The transcription itself went through, so the copy is about the next
 * run and nothing else. No engine-fallback bullets: the browser is not
 * what refused, its storage is, and a different browser on the same
 * full disk behaves the same way.
 */
function TranscriptionModelCacheFailedBody({ reason }: { readonly reason: FailureReason }): ReactElement {
  const lead = 'Transcribing on your device needs to download a model. Tscaps saves it so your next video can start right away, but this time something went wrong, so the next video will download it again.';
  if (reason === 'storage-full') {
    return (
      <ErrorBody
        lead={lead}
        bullets={[
          'Free up disk space on your device.',
          'Clear site data for sites you no longer use.',
          'If you are in a private or incognito window, open tscaps in a normal one.',
        ]}
      />
    );
  }
  return (
    <ErrorBody
      lead={lead}
      bullets={[
        'If you are in a private or incognito window, open tscaps in a normal one. Private windows delete everything when you close them.',
        'Check whether your browser erases site data every time it closes. If it does, add an exception for tscaps.',
      ]}
    />
  );
}


function GenericFailureBody({ isMobile }: { isMobile: boolean }): ReactElement {
  const fallbackBullets = useEngineFallbackBullets(isMobile);
  return (
    <ErrorBody
      lead="An unexpected error happened."
      bullets={['Reload the page and start again.', ...fallbackBullets]}
    />
  );
}

/**
 * Bullets that point the user at a more capable browser engine.
 * Only relevant for failures whose root cause sits in the browser
 * runtime — codec / encoder / worker / WebGPU paths. Network,
 * storage, or server-side failures do not benefit from these hints
 * and must not include them. The Chromium suggestion is dropped when
 * the user is already on a Chromium-based browser — pointing them at
 * the browser they are in is a dead end.
 */
export function useEngineFallbackBullets(isMobile: boolean): string[] {
  const browser = useUtils().userAgentInspector.getBrowser();
  const isChromiumBased = browser === 'chrome' || browser === 'edge' || browser === 'opera';
  const bullets: string[] = [];
  if (!isChromiumBased) {
    bullets.push(
      'Open tscaps in a Chromium-based browser (Chrome, Edge, Brave). They have the broadest support for what tscaps needs.',
    );
  }
  if (isMobile) bullets.push("If you're on mobile, try from a desktop browser.");
  return bullets;
}

/** Frames the support line for what the body was able to offer. */
function inviteToSupport(kind: SupportKind, hasBullets: boolean): string {
  if (kind === 'mistake') return 'If you think this is a mistake, email us at ';
  return hasBullets ? 'Still stuck? Email us at ' : 'Email us at ';
}

/** Announces the list that follows; `null` when there is no list to announce. */
function announceBullets(bullets: readonly string[], kind: SuggestionKind): string | null {
  if (bullets.length < 2) return null;
  const subject = bullets.length === 2 ? 'A couple of things' : 'A few things';
  return kind === 'check' ? `${subject} to check:` : `${subject} you can try:`;
}

/**
 * Body layout for a failure with remedies: what happened, what to do
 * about it, and how to reach support.
 *
 * `lead` says what happened and stands on its own. Announcing the
 * bullets is this component's job because the count is only known
 * here — several bodies build their list out of the browser and the
 * device, and come back with nothing to offer.
 */
function ErrorBody({
  lead,
  bullets,
  suggestions = 'try',
  support = 'stuck',
  details,
}: {
  readonly lead: string;
  readonly bullets: readonly string[];
  readonly suggestions?: SuggestionKind;
  readonly support?: SupportKind;
  readonly details?: string;
}): ReactElement {
  const announcement = announceBullets(bullets, suggestions);
  return (
    <div className="space-y-2">
      <p className="m-0">{announcement ? `${lead} ${announcement}` : lead}</p>
      {bullets.length >= 2 && (
        <ul className="list-disc pl-5 m-0 space-y-1">
          {bullets.map((text) => <li key={text}>{text}</li>)}
        </ul>
      )}
      {bullets.length === 1 && <p className="m-0">{bullets[0]}</p>}
      <p className="m-0">
        {inviteToSupport(support, bullets.length > 0)}
        <SupportLink /> and we&apos;ll take a look.
      </p>
      {details && <p className="m-0 text-fg-faint text-xs">{details}</p>}
    </div>
  );
}

function SupportLink(): ReactElement {
  return (
    <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
      {SUPPORT_EMAIL}
    </a>
  );
}
