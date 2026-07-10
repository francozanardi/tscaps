import type { ReactElement } from 'react';
import type { AppError } from '@core/_shared/domain/AppError';
import type { UnsupportedAudioCodecError } from '@core/videos/domain/errors/UnsupportedAudioCodecError';
import type { UnsupportedVideoCodecError } from '@core/videos/domain/errors/UnsupportedVideoCodecError';

const SUPPORT_EMAIL = 'support@tscaps.io';

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
    case 'ExportFailedError':                return "Export didn't finish";
    case 'ProjectListLoadFailedError':       return "Couldn't load your projects";
    case 'ProjectDeleteFailedError':         return "Couldn't delete this project";
    case 'ProjectExportFailedError':         return "Couldn't export this project";
    case 'ProjectImportFailedError':         return "Couldn't import this project";
    case 'LocalTranscriptionFailedError':    return "On-device transcription didn't finish";
    case 'PreviewProxyGenerationFailedError': return "Couldn't prepare the preview";
    case 'UnsupportedVideoCodecError':       return "This video can't play in your browser";
    case 'UnsupportedAudioCodecError':       return "This video's audio can't play in your browser";
    default: {
      const _: never = error.name;
      return _;
    }
  }
}

/**
 * Renders the body text for an `AppError` — what happened, what the
 * user can try, and how to reach support. The title is intentionally
 * not included; surfaces compose it via `getAppErrorTitle` so they
 * can place it in their own header style.
 */
export function AppErrorMessage({ error, isMobile = false }: AppErrorMessageProps): ReactElement {
  switch (error.name) {
    case 'UnknownAppError':                  return <GenericFailureBody isMobile={isMobile} />;
    case 'ProjectSaveFailedError':           return <ProjectSaveFailedBody />;
    case 'ExportFailedError':                return <ExportFailedBody isMobile={isMobile} />;
    case 'ProjectListLoadFailedError':       return <ProjectListLoadFailedBody />;
    case 'ProjectDeleteFailedError':         return <ProjectDeleteFailedBody />;
    case 'ProjectExportFailedError':         return <ProjectExportFailedBody />;
    case 'ProjectImportFailedError':         return <ProjectImportFailedBody />;
    case 'LocalTranscriptionFailedError':    return <LocalTranscriptionFailedBody isMobile={isMobile} />;
    case 'PreviewProxyGenerationFailedError': return <PreviewProxyGenerationFailedBody isMobile={isMobile} />;
    case 'UnsupportedVideoCodecError':       return <UnsupportedVideoCodecBody error={error as UnsupportedVideoCodecError} isMobile={isMobile} />;
    case 'UnsupportedAudioCodecError':       return <UnsupportedAudioCodecBody error={error as UnsupportedAudioCodecError} isMobile={isMobile} />;
    default: {
      const _: never = error.name;
      return _;
    }
  }
}

function PreviewProxyGenerationFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="We couldn't prepare an optimized preview for this video. A few things you can try:"
      bullets={['Upload a different video.', ...engineFallbackBullets(isMobile)]}
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
  return (
    <ErrorBody
      lead="Your browser doesn't support this video's format. A few things you can try:"
      bullets={['Convert the video to H.264 (MP4) and upload it again.', ...engineFallbackBullets(isMobile)]}
      details={`Source codec: ${error.codec}`}
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
  return (
    <ErrorBody
      lead="Your browser can't process this video's audio. A few things you can try:"
      bullets={['Convert the audio to AAC or Opus and upload again.', ...engineFallbackBullets(isMobile)]}
      details={`Source codec: ${error.codec}`}
    />
  );
}


function ProjectSaveFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to save your changes."
      bullets={['Check your internet connection.']}
    />
  );
}

function ExportFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="Something went wrong while burning the subtitles into your video. A few things you can try:"
      bullets={engineFallbackBullets(isMobile)}
    />
  );
}

function ProjectListLoadFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to load your projects."
      bullets={['Check your internet connection.']}
    />
  );
}

function ProjectDeleteFailedBody(): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to delete this project."
      bullets={['Check your internet connection.']}
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


function LocalTranscriptionFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="In-browser transcription couldn't complete on your device. A few things you can try:"
      bullets={['Try a shorter video.', ...engineFallbackBullets(isMobile)]}
    />
  );
}

function GenericFailureBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="An unexpected error happened. A few things you can try:"
      bullets={engineFallbackBullets(isMobile)}
    />
  );
}

/**
 * Bullets that point the user at a more capable browser engine.
 * Only relevant for failures whose root cause sits in the browser
 * runtime — codec / encoder / worker / WebGPU paths. Network,
 * storage, or server-side failures do not benefit from these hints
 * and must not include them.
 */
function engineFallbackBullets(isMobile: boolean): string[] {
  const bullets = [
    'Open tscaps in a Chromium-based browser (Chrome, Edge, Brave) — they have the broadest support for our pipeline.',
  ];
  if (isMobile) bullets.push("If you're on mobile, try from a desktop browser.");
  return bullets;
}

function ErrorBody({
  lead,
  bullets,
  details,
}: {
  readonly lead: string;
  readonly bullets: readonly string[];
  readonly details?: string;
}): ReactElement {
  return (
    <div className="space-y-2">
      <p className="m-0">{lead}</p>
      {bullets.length >= 2 && (
        <ul className="list-disc pl-5 m-0 space-y-1">
          {bullets.map((text) => <li key={text}>{text}</li>)}
        </ul>
      )}
      {bullets.length === 1 && <p className="m-0">{bullets[0]}</p>}
      <p className="m-0">
        Still stuck? Email us at <SupportLink /> and we&apos;ll take a look.
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
