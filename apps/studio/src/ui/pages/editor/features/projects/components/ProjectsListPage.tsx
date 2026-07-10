import { memo, useRef, type ReactNode } from 'react';
import { Plus, Upload } from 'lucide-react';
import type { AppError } from '@core/_shared/domain/AppError';
import type { ProjectMetadata } from '@core/projects/domain/ProjectMetadata';
import type { ThemeController } from '@presentation/theme/controllers/ThemeController';
import { ThemeToggle } from '@ui/_shared/components/ThemeToggle/ThemeToggle';
import { Wordmark } from '@ui/_shared/components/Wordmark/Wordmark';
import { StatusPill } from '@ui/_shared/components/StatusPill/StatusPill';
import { AppErrorMessage, getAppErrorTitle } from '@ui/_shared/components/AppErrorMessage/AppErrorMessage';
import { ProjectCard } from '@ui/pages/editor/features/projects/components/ProjectCard';

interface ProjectsListPageProps {
  projects: ProjectMetadata[] | null;
  isLoading: boolean;
  error: AppError | null;
  isMobileDevice: boolean;
  /** Destination for the wordmark click. */
  homeHref: string;
  title: string;
  subtitle: (count: number) => string;
  emptyTitle: string;
  emptyBody: string;
  /** Optional banner rendered between the page header and the project grid. */
  headerNote?: ReactNode;
  /** Optional discreet note rendered below the project grid. */
  footerNote?: ReactNode;
  /** Optional actions rendered in the top-right utility cluster, next to the theme toggle. */
  trailingChromeActions?: ReactNode;
  onNewProject: (file: File) => void;
  /**
   * Optional pre-flight check fired on "New project" click before the
   * file picker opens. Return `true` to indicate the click was handled
   * by the host and the picker should stay shut.
   */
  onNewProjectIntent?: () => boolean;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => Promise<void>;
  /** Optional — when present, an "Export" button on each card and an "Import .tscaps" header button appear. */
  onExportProject?: (id: string) => void;
  onImportProject?: (file: File) => void;
  theme: ThemeController;
}

const CHROME =
  'sticky top-0 z-30 bg-surface-0/85 backdrop-blur-sm border-b border-edge-subtle';
const CHROME_INNER =
  'max-w-[1280px] mx-auto w-full px-5 lg:px-8 h-16 flex items-center justify-between';
const UTILITY_CLUSTER = 'flex items-center gap-2';

const MAIN = 'flex-1 max-w-[1280px] mx-auto w-full px-5 lg:px-8 py-10 lg:py-14 flex flex-col gap-8';

const PAGE_HEADER = 'flex items-end justify-between gap-4 flex-wrap';
const PAGE_TITLE = 'text-2xl lg:text-3xl font-semibold tracking-[-0.022em] text-fg-primary m-0';
const PAGE_SUBTITLE = 'text-sm text-fg-muted m-0 mt-1';

const BTN_BASE =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xs text-sm font-medium border ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 ' +
  'active:duration-instant';
const BTN_SECONDARY = `${BTN_BASE} bg-surface-1 border-edge-medium text-fg-primary hover:bg-surface-2 hover:border-edge-strong`;
const BTN_PRIMARY = `${BTN_BASE} bg-accent border-accent text-white hover:bg-accent-hover hover:border-accent-hover`;

const ERROR_BANNER =
  'px-4 py-3 rounded-xs bg-danger/10 border border-danger/30 text-danger text-sm';

const EMPTY_STATE = 'flex flex-col items-center text-center py-20 lg:py-28 gap-3';
const EMPTY_TITLE =
  'text-2xl lg:text-3xl font-semibold tracking-[-0.022em] text-fg-primary m-0';
const EMPTY_SUB = 'text-sm text-fg-muted m-0 max-w-[42ch]';

/**
 * The shared "your projects" page. Renderer-only: it owns no
 * application state and emits no side effects beyond the file-input
 * click bridge. Orchestration (which list to fetch, which CTAs to
 * expose, what banner to render) lives in its host.
 */
export const ProjectsListPage = memo(function ProjectsListPage({
  projects,
  isLoading,
  error,
  isMobileDevice,
  homeHref,
  title,
  subtitle,
  emptyTitle,
  emptyBody,
  headerNote,
  footerNote,
  trailingChromeActions,
  onNewProject,
  onNewProjectIntent,
  onOpenProject,
  onDeleteProject,
  onExportProject,
  onImportProject,
  theme,
}: ProjectsListPageProps) {
  const newInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleNewClick = () => {
    if (onNewProjectIntent?.()) return;
    newInputRef.current?.click();
  };
  const handleImportClick = () => importInputRef.current?.click();

  const handleNewSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onNewProject(file);
    e.target.value = '';
  };

  const handleImportSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportProject) onImportProject(file);
    e.target.value = '';
  };

  const count = projects?.length ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-surface-0">
      <header className={CHROME}>
        <div className={CHROME_INNER}>
          <Wordmark href={homeHref} size="lg" />
          <div className={UTILITY_CLUSTER}>
            <ThemeToggle controller={theme} />
            {trailingChromeActions}
          </div>
        </div>
      </header>

      <main className={MAIN}>
        <div className={PAGE_HEADER}>
          <div className="min-w-0">
            <h1 className={PAGE_TITLE}>{title}</h1>
            {count > 0 && <p className={PAGE_SUBTITLE}>{subtitle(count)}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onImportProject && (
              <button type="button" className={BTN_SECONDARY} onClick={handleImportClick}>
                <Upload size={14} />
                <span>Import .tscaps</span>
              </button>
            )}
            <button type="button" className={BTN_PRIMARY} onClick={handleNewClick}>
              <Plus size={14} />
              <span>New project</span>
            </button>
            <input ref={newInputRef} type="file" accept="video/*" onChange={handleNewSelected} hidden />
            {onImportProject && (
              <input ref={importInputRef} type="file" accept=".tscaps,application/json" onChange={handleImportSelected} hidden />
            )}
          </div>
        </div>

        {headerNote}

        {error && (
          <div role="alert" className={ERROR_BANNER}>
            <p className="font-semibold m-0 mb-1">{getAppErrorTitle(error)}</p>
            <div className="text-fg-secondary">
              <AppErrorMessage error={error} isMobile={isMobileDevice} />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className={EMPTY_STATE}>
            <StatusPill label="Loading projects" tone="info" active />
          </div>
        ) : count > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {projects!.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={onOpenProject}
                onDelete={onDeleteProject}
                {...(onExportProject ? { onExport: onExportProject } : {})}
              />
            ))}
          </div>
        ) : (
          <div className={EMPTY_STATE}>
            <h2 className={EMPTY_TITLE}>{emptyTitle}</h2>
            <p className={EMPTY_SUB}>{emptyBody}</p>
          </div>
        )}

        {footerNote}
      </main>
    </div>
  );
});
