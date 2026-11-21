import { Upload } from 'lucide-react';
import type { SoundPickerMode, SoundPickerPresenter } from '@presentation/audio-mix/services/SoundPickerPresenter';
import { BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';

interface SoundPickerNoFilesProps {
  mode: SoundPickerMode;
  presenter: SoundPickerPresenter;
  /** Whether a file handed over is still being added. */
  isAdding: boolean;
  /** Opens the file dialog. */
  onChoose: () => void;
}

const ZONE_CLASS = 'flex flex-col items-center gap-2 m-2 px-4 py-6 rounded-sm border border-dashed border-edge-medium text-center';

/**
 * The user's files while there are none: what to do, where a file can
 * be dropped, the kinds that work, and the button that opens the file
 * dialog.
 */
export function SoundPickerNoFiles({ mode, presenter, isAdding, onChoose }: SoundPickerNoFilesProps) {
  return (
    <div className={ZONE_CLASS}>
      <Upload size={16} className="text-fg-muted" aria-hidden />
      <p className="m-0 text-xs text-fg-primary leading-snug">{presenter.noFilesLine(mode)}</p>
      <p className="m-0 text-2xs text-fg-muted leading-snug">{presenter.emptyHint()}</p>
      <button type="button" className={`${BTN_SECONDARY_SM} mt-2`} disabled={isAdding} onClick={onChoose}>
        {isAdding ? presenter.uploadingLabel() : presenter.chooseFileLabel()}
      </button>
      <p className="m-0 font-mono text-3xs text-fg-faint">{presenter.formatsLine()}</p>
    </div>
  );
}
