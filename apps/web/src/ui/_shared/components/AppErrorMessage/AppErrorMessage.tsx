import type { ReactElement } from 'react';
import type { AppError } from '@core/_shared/domain/AppError';

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
    default: {
      const _: never = error.name;
      return _;
    }
  }
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
}: {
  readonly lead: string;
  readonly bullets: readonly string[];
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
