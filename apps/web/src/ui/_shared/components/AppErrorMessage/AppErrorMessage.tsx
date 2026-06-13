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
    case 'AudioExtractionFailedError': return "Couldn't read this video's audio";
    case 'ProjectSaveFailedError':     return "Couldn't save your project";
    case 'ExportFailedError':          return "Export didn't finish";
    case 'ProjectListLoadFailedError': return "Couldn't load your projects";
    case 'ProjectDeleteFailedError':   return "Couldn't delete this project";
    case 'ProjectExportFailedError':   return "Couldn't export this project";
    case 'ProjectImportFailedError':   return "Couldn't import this project";
    default:                           return 'Something went wrong';
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
    case 'AudioExtractionFailedError': return <AudioExtractionFailedBody isMobile={isMobile} />;
    case 'ProjectSaveFailedError':     return <ProjectSaveFailedBody isMobile={isMobile} />;
    case 'ExportFailedError':          return <ExportFailedBody isMobile={isMobile} />;
    case 'ProjectListLoadFailedError': return <ProjectListLoadFailedBody isMobile={isMobile} />;
    case 'ProjectDeleteFailedError':   return <ProjectDeleteFailedBody isMobile={isMobile} />;
    case 'ProjectExportFailedError':   return <ProjectExportFailedBody isMobile={isMobile} />;
    case 'ProjectImportFailedError':   return <ProjectImportFailedBody isMobile={isMobile} />;
    default:                           return <GenericFailureBody isMobile={isMobile} />;
  }
}

function AudioExtractionFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to read the audio from this video. A few things you can try:"
      specificBullets={['Upload a different video.']}
      isMobile={isMobile}
    />
  );
}

function ProjectSaveFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to save your changes. A few things you can try:"
      specificBullets={['Check your internet connection.']}
      isMobile={isMobile}
    />
  );
}

function ExportFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="Something went wrong while burning the subtitles into your video. A few things you can try:"
      specificBullets={[]}
      isMobile={isMobile}
    />
  );
}

function ProjectListLoadFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to load your projects. A few things you can try:"
      specificBullets={['Check your internet connection.']}
      isMobile={isMobile}
    />
  );
}

function ProjectDeleteFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to delete this project. A few things you can try:"
      specificBullets={['Check your internet connection.']}
      isMobile={isMobile}
    />
  );
}

function ProjectExportFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to package this project for export. A few things you can try:"
      specificBullets={[]}
      isMobile={isMobile}
    />
  );
}

function ProjectImportFailedBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="We weren't able to read this file. A few things you can try:"
      specificBullets={['Make sure the file is a valid .tscaps export.']}
      isMobile={isMobile}
    />
  );
}

function GenericFailureBody({ isMobile }: { isMobile: boolean }): ReactElement {
  return (
    <ErrorBody
      lead="An unexpected error happened. A few things you can try:"
      specificBullets={[]}
      isMobile={isMobile}
    />
  );
}

function ErrorBody({
  lead,
  specificBullets,
  isMobile,
}: {
  readonly lead: string;
  readonly specificBullets: readonly string[];
  readonly isMobile: boolean;
}): ReactElement {
  const bullets: string[] = [
    ...specificBullets,
    'Open tscaps in a Chromium-based browser (Chrome, Edge, Brave) — they have the broadest support for our pipeline.',
  ];
  if (isMobile) {
    bullets.push("If you're on mobile, try from a desktop browser.");
  }
  return (
    <div className="space-y-2">
      <p className="m-0">{lead}</p>
      {bullets.length >= 2
        ? (
          <ul className="list-disc pl-5 m-0 space-y-1">
            {bullets.map((text) => <li key={text}>{text}</li>)}
          </ul>
        )
        : <p className="m-0">{bullets[0]}</p>}
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
