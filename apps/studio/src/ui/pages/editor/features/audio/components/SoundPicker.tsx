import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Upload } from 'lucide-react';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import { SoundPickerPresenter, type SoundPickerList, type SoundPickerMode } from '@presentation/audio-mix/services/SoundPickerPresenter';
import { TabStrip } from '@ui/_shared/components/TabStrip/TabStrip';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { GROUP_HEADING_CLASS } from '@ui/pages/editor/features/audio/audio-classes';
import { SoundPickerBuiltinRow } from '@ui/pages/editor/features/audio/components/SoundPickerBuiltinRow';
import { SoundPickerFileRow } from '@ui/pages/editor/features/audio/components/SoundPickerFileRow';
import { SoundPickerNoFiles } from '@ui/pages/editor/features/audio/components/SoundPickerNoFiles';
import { useAudioFileUpload } from '@ui/pages/editor/features/audio/hooks/useAudioFileUpload';
import { useSoundAudition } from '@ui/pages/editor/features/audio/hooks/useSoundAudition';
import { useFileDropTarget } from '@ui/pages/editor/features/media/hooks/useFileDropTarget';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';
import { useWaveformPosterSampler } from '@ui/pages/editor/features/media/hooks/useWaveformPoster';
import { useTelemetry } from '@ui/_shared/contexts/modules/TelemetryContext';
import { SoundPickerVisitTelemetry } from '@presentation/telemetry/services/SoundPickerVisitTelemetry';

interface SoundPickerProps {
  /** What the sound is for: music offers the user's files alone. */
  mode: SoundPickerMode;
  projectId: string | null;
  /** The word on each entry's pick button, saying what picking does: *Add*, *Use*. */
  pickLabel: string;
  /** Called with the sound picked, or with a file just uploaded. */
  onPick: (source: AudioSourceRef) => void;
}

// Shrinks to what its container allows (a popover screen held to the room it has): the list gives way, the
// header and the footer keep their height.
const PICKER_CLASS = 'relative flex flex-col w-72 min-h-0';
const HEADER_CLASS = 'flex shrink-0 items-end justify-between gap-2 h-8 px-3 border-b border-edge-subtle';
// Out of the tab order: Tab goes from the popover straight to the first sound, whose focus shows.
// The app's thin scrollbar: without it the browser's own, light in a dark popover.
const LIST_CLASS = 'flex flex-col min-h-0 max-h-80 overflow-y-auto py-1 outline-none thin-scroll [scrollbar-width:thin] [scrollbar-color:rgb(var(--color-fg-faint)/0.25)_transparent]';
const FOOTER_CLASS = 'shrink-0 p-1 border-t border-edge-subtle';
const UPLOAD_CLASS =
  'flex items-center gap-2 w-full h-8 px-2 rounded-xs bg-transparent border-none text-xs text-fg-secondary text-left cursor-pointer '
  + 'transition-colors duration-quick ease-standard hover:bg-surface-3 hover:text-fg-primary '
  + 'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-primary disabled:opacity-40 disabled:cursor-not-allowed';
const DROP_OVERLAY_CLASS =
  'absolute inset-1 flex items-center justify-center gap-2 rounded-sm border border-dashed border-accent bg-surface-2/90 '
  + 'text-xs text-accent pointer-events-none';

/**
 * Where a sound is chosen: the bundled sounds by category, the user's
 * audio files with their waveforms, names and lengths, and a way to add
 * one. Pressing an entry plays it, once, and pressing it again stops it;
 * its pick button picks it. A file chosen or dropped anywhere on the
 * picker is added to the project and picked at once.
 *
 * Holds no chrome of its own, so it sits as well in a popover of its
 * own as in a screen of another one. What it plays stops when it closes.
 */
export const SoundPicker = memo(function SoundPicker({ mode, projectId, pickLabel, onPick }: SoundPickerProps) {
  const { services } = useAudioMix();
  const media = useMediaAssets();
  const player = useSoundAudition();
  const waveformSampler = useWaveformPosterSampler();
  const presenter = useMemo(() => new SoundPickerPresenter(services.builtinSounds), [services]);
  const lists = presenter.listsFor(mode);
  const firstList = lists[0]!.value;
  const [shown, setShown] = useState<SoundPickerList>(firstList);
  const telemetry = useTelemetry();
  // One visit per opening: the picker unmounts when it closes, which is when the visit reports.
  const visit = useMemo(() => new SoundPickerVisitTelemetry(telemetry, mode, firstList), [telemetry, mode, firstList]);
  useEffect(() => () => visit.closed(), [visit]);
  const pickSound = (source: AudioSourceRef) => {
    visit.picked(source.kind === 'builtin' ? 'builtin' : 'file');
    onPick(source);
  };
  const audition = (source: AudioSourceRef) => {
    visit.auditioned();
    player.toggle(source);
  };
  const showList = (list: SoundPickerList) => {
    visit.showedList(list);
    setShown(list);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const files = presenter.filesOf(media);
  const upload = useAudioFileUpload(pickSound);
  const drop = useFileDropTarget((dropped) => {
    const file = presenter.fileToAddOf(dropped);
    if (file !== null) upload.add(file);
  });
  const choose = () => inputRef.current?.click();
  const chosen = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file !== undefined) upload.add(file);
  };
  const showsNoFiles = shown === 'files' && files.length === 0;

  return (
    <Tabs.Root value={shown} onValueChange={(value) => showList(value as SoundPickerList)} className={PICKER_CLASS} {...drop.handlers}>
      <div className={HEADER_CLASS}>
        {lists.length > 1 ? <TabStrip items={lists} label="Which sounds" /> : (
          <>
            <h3 className="m-0 pb-2 text-xs font-medium text-fg-secondary">{presenter.filesTitle()}</h3>
            {files.length > 0 && <span className="pb-2 font-mono text-3xs text-fg-faint tabular-nums">{files.length}</span>}
          </>
        )}
      </div>
      {lists.some((list) => list.value === 'builtin') && (
        <Tabs.Content value="builtin" className={LIST_CLASS} tabIndex={-1}>
          {presenter.builtinGroups().map((group) => (
            <section key={group.category} aria-label={group.title}>
              <h4 className={GROUP_HEADING_CLASS}>{group.title}</h4>
              {group.sounds.map((sound) => {
                const source: AudioSourceRef = { kind: 'builtin', soundId: sound.id };
                return (
                  <SoundPickerBuiltinRow
                    key={sound.id}
                    name={sound.name}
                    length={presenter.lengthOf(sound)}
                    isPlaying={player.isPlaying(source)}
                    pickLabel={pickLabel}
                    onAudition={() => audition(source)}
                    onPick={() => pickSound(source)}
                  />
                );
              })}
            </section>
          ))}
        </Tabs.Content>
      )}
      <Tabs.Content value="files" className={LIST_CLASS} tabIndex={-1}>
        {files.length === 0 ? (
          <SoundPickerNoFiles mode={mode} presenter={presenter} isAdding={upload.isAdding} onChoose={choose} />
        ) : files.map((file) => {
          const source: AudioSourceRef = { kind: 'media', mediaId: file.id };
          return (
            <SoundPickerFileRow
              key={file.id}
              file={file}
              projectId={projectId}
              waveformSampler={waveformSampler}
              presenter={presenter}
              isPlaying={player.isPlaying(source)}
              pickLabel={pickLabel}
              onAudition={() => audition(source)}
              onPick={() => pickSound(source)}
            />
          );
        })}
      </Tabs.Content>
      {!showsNoFiles && (
        <div className={FOOTER_CLASS}>
          <button type="button" className={UPLOAD_CLASS} disabled={upload.isAdding} onClick={choose}>
            <Upload size={14} className="shrink-0 text-fg-muted" aria-hidden />
            {upload.isAdding ? presenter.uploadingLabel() : presenter.uploadLabel()}
          </button>
        </div>
      )}
      {drop.isDragging && (
        <div className={DROP_OVERLAY_CLASS} aria-hidden>
          <Upload size={14} /> {presenter.dropLabel()}
        </div>
      )}
      <input ref={inputRef} type="file" accept={presenter.acceptedFiles()} onChange={chosen} hidden />
    </Tabs.Root>
  );
});
