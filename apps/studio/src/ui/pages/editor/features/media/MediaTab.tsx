import { memo, useCallback, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Upload } from 'lucide-react';
import type { AppError } from '@core/errors/domain/AppError';
import type { MediaAsset } from '@core/media/domain/MediaAsset';
import type { MediaAssetDestination } from '@core/media/services/MediaAssetOwnerResolver';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import { MediaAssetDragFormat } from '@presentation/media/services/MediaAssetDragFormat';
import { MediaBinPresenter, type MediaBinScope } from '@presentation/media/services/MediaBinPresenter';
import { ConfirmDialog } from '@ui/_shared/components/Dialog/ConfirmDialog';
import { TabStrip, type TabStripItem } from '@ui/_shared/components/TabStrip/TabStrip';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { useErrors } from '@ui/_shared/contexts/modules/ErrorsContext';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { useEditorAudioMix } from '@ui/_shared/contexts/EditorStoreContext';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { EditorTab } from '@ui/pages/editor/components/sidebar/tabs/EditorTab';
import { MediaBinEmptyState } from '@ui/pages/editor/features/media/components/MediaBinEmptyState';
import { MediaBinGrid } from '@ui/pages/editor/features/media/components/MediaBinGrid';
import { MediaFileMenu } from '@ui/pages/editor/features/media/components/MediaFileMenu';
import { useFileDropTarget } from '@ui/pages/editor/features/media/hooks/useFileDropTarget';
import type { MediaImportOrigin } from '@core/media/services/MediaImportTelemetryReporter';
import { useLibraryFileExpiryLabels } from '@ui/pages/editor/features/media/hooks/useLibraryFileExpiryLabels';
import { useLibraryReachesOtherDevices } from '@ui/pages/editor/features/media/hooks/useLibraryReachesOtherDevices';
import { useLibraryRetentionHint } from '@ui/pages/editor/features/media/hooks/useLibraryRetentionHint';
import type { MediaAssetPosterSamplers } from '@ui/pages/editor/features/media/hooks/useMediaAssetPoster';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';
import { useMediaLibraryGate } from '@ui/pages/editor/features/media/hooks/useMediaLibraryGate';
import { useRetryMediaAsset } from '@ui/pages/editor/features/media/hooks/useRetryMediaAsset';
import { useStillPosterSampler } from '@ui/pages/editor/features/media/hooks/useStillPoster';
import { useWaveformPosterSampler } from '@ui/pages/editor/features/media/hooks/useWaveformPoster';
import { useVideoFrameSampler } from '@ui/pages/editor/features/shots/hooks/useVideoFrameSampler';

interface MediaTabProps {
  shots: ShotPartition;
  projectId: string | null;
  /** Which files the bin shows, kept by the caller so it outlives this tab. */
  scope: MediaBinScope;
  onScopeChange: (scope: MediaBinScope) => void;
  /** Whether the video has shots a file could be shown on. */
  hasShots: boolean;
}

// Held by id: the file is re-read on every render, so one deleted while its menu is open closes it.
interface OpenMenu {
  mediaId: string;
  point: { x: number; y: number };
}

const PRESENTER = new MediaBinPresenter();
const DRAG_FORMAT = new MediaAssetDragFormat();
// The extensions are for systems that give some audio files no type, which `audio/*` alone would hide.
const ACCEPTED_FILES = 'video/*,image/png,image/jpeg,image/webp,image/gif,audio/*,.m4a,.opus,.flac';
const SCOPES: readonly MediaBinScope[] = ['project', 'library'];
const SCOPE_TABS: readonly TabStripItem[] = [
  { value: 'project', label: 'This project' },
  { value: 'library', label: 'Library' },
];

// One height whatever the scope holds, so switching scopes never moves what is under the strip.
const STRIP_ROW_CLASS = 'flex items-end justify-between gap-2 h-8 border-b border-edge-subtle mb-2';
const COUNT_CLASS = 'mb-2 text-2xs text-fg-muted tabular-nums';
const UPLOAD_CLASS =
  'inline-flex items-center justify-center w-6 h-6 mb-1 shrink-0 rounded-xs bg-transparent border-none '
  + 'text-fg-faint cursor-pointer transition-colors duration-quick ease-standard '
  + 'hover:text-fg-secondary focus-visible:outline-none focus-visible:text-fg-secondary';
// What the scope is, with the plan's retention under it as the quieter line of one block.
const NOTES_CLASS = 'flex flex-col mb-2 text-3xs leading-4';
// Drawn over the whole tab while files are dragged across it.
const DROP_OVERLAY_CLASS =
  'absolute inset-0 z-10 flex items-center justify-center rounded-sm pointer-events-none '
  + 'border-2 border-dashed border-accent bg-surface-1/85 text-2xs text-fg-primary';

/**
 * The media bin: every file the open project can use, as a grid of
 * tiles, in two scopes — what the project has or uses (its own files
 * and the library files its shots show or its sounds play, those marked
 * as the library's), and the user's library, which every project can use. Files are added
 * to the scope on show, from the picker or by dropping them anywhere on
 * the tab. Where the reader cannot use a library, its scope shows the
 * gate to one, takes no file, and the menu's save there is gated the
 * same way. On a plan that deletes library files nobody uses, the
 * library says so, and a file close to being deleted says when on its
 * tile.
 *
 * A video, a picture or a GIF goes on a shot by dragging its tile onto
 * the shot's card, or from its menu onto the shot under the playhead; an
 * audio file goes on no shot, and its menu makes it the project's music
 * instead, replacing any there is. The menu is also the
 * one place a file is saved to the library, kept only in this project
 * (after a warning that other projects lose it), or deleted. Taking a
 * file off a shot keeps it in the bin, to be used again; a library file
 * nothing in the project uses any more is then listed in the library alone.
 */
export const MediaTab = memo(function MediaTab({ shots, projectId, scope, onScopeChange, hasShots }: MediaTabProps) {
  const { actions } = useMedia();
  const shotsModule = useShots();
  const audioMix = useAudioMix();
  const { appNoticeChannel } = useErrors();
  const catalog = useMediaAssets();
  const retry = useRetryMediaAsset();
  const libraryReachesOtherDevices = useLibraryReachesOtherDevices();
  const libraryGate = useMediaLibraryGate();
  const libraryRetentionHint = useLibraryRetentionHint();
  const expiryLabelOf = useLibraryFileExpiryLabels();
  const videoSampler = useVideoFrameSampler();
  const stillSampler = useStillPosterSampler();
  const samplers = useMemo<MediaAssetPosterSamplers>(() => ({ video: videoSampler, still: stillSampler }), [videoSampler, stillSampler]);
  const waveformSampler = useWaveformPosterSampler();
  const inputRef = useRef<HTMLInputElement>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MediaAsset | null>(null);
  const [pendingKeepInProject, setPendingKeepInProject] = useState<MediaAsset | null>(null);
  const mix = useEditorAudioMix();
  const usage = useMemo(() => PRESENTER.usageOf(shots, mix), [shots, mix]);
  // The scope new files go to; none while the library is on show and shut.
  const addsTo: MediaBinScope | null = scope === 'library' && libraryGate !== null ? null : scope;
  const lockedLibrary: ReactNode = null;
  const lockedSaveToLibrary: ReactNode = null;

  // Each action only ever rejects with its own failure, which carries its copy.
  const publish = useCallback((error: unknown) => appNoticeChannel.publish(error as AppError), [appNoticeChannel]);
  const add = (picked: readonly File[], origin: MediaImportOrigin) => {
    if (addsTo === null) return;
    for (const file of picked) actions.import.execute(file, addsTo, origin).catch(publish);
  };
  const choose = () => inputRef.current?.click();
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = [...(event.target.files ?? [])];
    event.target.value = '';
    add(picked, 'bin-picker');
  };
  const drop = useFileDropTarget((dropped) => add(dropped, 'bin-drop'));
  const moveTo = (file: MediaAsset, owner: MediaAssetDestination) => {
    actions.move.execute(file.id, owner).catch(publish);
  };
  // Saving to the library takes nothing from anyone; keeping a library file here alone takes it from every other project.
  const move = (file: MediaAsset) => {
    if (file.owner.kind === 'library') setPendingKeepInProject(file);
    else moveTo(file, 'library');
  };
  const remove = (mediaId: string) => {
    actions.remove.execute(mediaId).catch((error: unknown) => {
      console.error(`[media] media file ${mediaId} could not be deleted in full`, error);
    });
  };
  const openMenuFor = useCallback(
    (file: MediaAsset, point: { x: number; y: number }) => setOpenMenu({ mediaId: file.id, point }),
    [],
  );
  const askToDelete = useCallback((file: MediaAsset) => setPendingDelete(file), []);

  const menuFile = openMenu ? catalog.get(openMenu.mediaId) : null;
  const scopeHint = libraryGate === null ? PRESENTER.scopeHint(scope, libraryReachesOtherDevices) : null;
  const retentionHint = scope === 'library' && libraryGate === null ? libraryRetentionHint : null;

  return (
    <EditorTab title="Media" hideTitleRow>
      <div className="relative flex flex-col min-h-full" {...drop.handlers}>
        <Tabs.Root value={scope} onValueChange={(value) => onScopeChange(value as MediaBinScope)}>
          <div className={STRIP_ROW_CLASS}>
            <TabStrip items={SCOPE_TABS} label="Which files" />
            {addsTo !== null && (
              <span className="flex items-center gap-2">
                <span className={COUNT_CLASS}>{PRESENTER.countLabel(PRESENTER.filesIn(catalog, addsTo, usage).length)}</span>
                <Tooltip text={addsTo === 'project' ? 'Add files to this project' : 'Add files to your library'}>
                  <button type="button" className={UPLOAD_CLASS} aria-label="Add files" onClick={choose}>
                    <Upload size={14} strokeWidth={2} />
                  </button>
                </Tooltip>
              </span>
            )}
          </div>
          {scopeHint !== null && (
            <div className={NOTES_CLASS}>
              <p className="text-fg-muted">{scopeHint}</p>
              {retentionHint !== null && <p className="text-fg-faint">{retentionHint}</p>}
            </div>
          )}
          {SCOPES.map((shown) => {
            const files = PRESENTER.filesIn(catalog, shown, usage);
            return (
              <Tabs.Content key={shown} value={shown} className="outline-none">
                {shown === 'library' && lockedLibrary !== null ? (
                  lockedLibrary
                ) : files.length === 0 ? (
                  <MediaBinEmptyState copy={PRESENTER.emptyState(shown)} onChoose={choose} />
                ) : (
                  <MediaBinGrid
                    files={files}
                    usage={usage}
                    expiryLabelOf={expiryLabelOf}
                    projectId={projectId}
                    samplers={samplers}
                    waveformSampler={waveformSampler}
                    dragFormat={DRAG_FORMAT}
                    openMenuId={openMenu?.mediaId ?? null}
                    marksLibraryFiles={shown === 'project'}
                    label={shown === 'project' ? 'Files in this project' : 'Files in your library'}
                    onOpenMenu={openMenuFor}
                    onDelete={askToDelete}
                  />
                )}
              </Tabs.Content>
            );
          })}
        </Tabs.Root>
        <input ref={inputRef} type="file" accept={ACCEPTED_FILES} multiple onChange={upload} hidden />
        {drop.isDragging && (
          <div className={DROP_OVERLAY_CLASS} aria-hidden>
            {addsTo !== null ? PRESENTER.dropLabel(addsTo) : libraryGate?.label}
          </div>
        )}
      </div>
      {openMenu && menuFile && (
        <MediaFileMenu
          file={menuFile}
          open
          onOpenChange={(isOpen) => { if (!isOpen) setOpenMenu(null); }}
          point={openMenu.point}
          onAddToCurrentShot={PRESENTER.offersAddToShot(menuFile, hasShots)
            ? () => { shotsModule.actions.showFileOnCurrentShot.execute(menuFile.id).catch(publish); }
            : null}
          onUseAsMusic={PRESENTER.offersUseAsMusic(menuFile, usage.get(menuFile.id))
            ? () => { audioMix.actions.useAsMusic.execute({ kind: 'media', mediaId: menuFile.id }, 'media-bin'); }
            : null}
          onRetry={() => retry(menuFile.id)}
          onMove={() => move(menuFile)}
          lockedSaveToLibrary={lockedSaveToLibrary}
          onDelete={() => setPendingDelete(menuFile)}
        />
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        message={pendingDelete ? PRESENTER.deleteMessage(pendingDelete, usage.get(pendingDelete.id)) : ''}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (pendingDelete !== null) remove(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={pendingKeepInProject !== null}
        message={PRESENTER.keepOnlyInProjectMessage()}
        confirmLabel="Keep only in this project"
        onConfirm={() => {
          if (pendingKeepInProject !== null) moveTo(pendingKeepInProject, 'project');
          setPendingKeepInProject(null);
        }}
        onCancel={() => setPendingKeepInProject(null)}
      />
    </EditorTab>
  );
});
