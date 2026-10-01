import { useEffect, useState } from 'react';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';
import type { SkippedCueBlocksStore } from '@core/transcription/store/SkippedCueBlocksStore';

const BODY = 'text-sm text-fg-secondary leading-normal m-0';
const PANEL = 'rounded-xs border border-edge-subtle bg-surface-3 px-3 py-2 space-y-1';
const PANEL_LINE = 'text-sm text-fg-primary m-0 truncate';
const PANEL_MORE = 'text-xs text-fg-faint m-0';

const PREVIEWED_BLOCKS = 3;

interface SkippedCuesDialogProps {
  readonly store: SkippedCueBlocksStore;
}

function useSkippedBlocks(store: SkippedCueBlocksStore): readonly string[] {
  const [blocks, setBlocks] = useState<readonly string[]>(() => store.snapshot());
  useEffect(() => {
    const update = (): void => setBlocks(store.snapshot());
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [store]);
  return blocks;
}

/**
 * Post-run notice for text a subtitle file carried that never made it
 * into the captions. Renders nothing until something is dropped, and
 * comes back after a dismissal once a later file drops something.
 *
 * The dropped text is shown rather than counted, because the person
 * reading this is the only one who can look at their file and see
 * what is missing from it.
 */
export function SkippedCuesDialog({ store }: SkippedCuesDialogProps) {
  const blocks = useSkippedBlocks(store);
  const [dismissed, setDismissed] = useState<readonly string[] | null>(null);
  if (dismissed === blocks || blocks.length === 0) return null;
  const preview = blocks.slice(0, PREVIEWED_BLOCKS);
  const remaining = blocks.length - preview.length;
  return (
    <AppDialog
      open
      onClose={() => setDismissed(blocks)}
      size="md"
      title={
        blocks.length === 1
          ? "Part of this file couldn't be processed"
          : "Parts of this file couldn't be processed"
      }
    >
      <p className={BODY}>
        Your captions are ready, minus the text below. Each of these sits in your file without a
        timecode above it, so there was no way to know when it should appear.
      </p>

      <div className={PANEL}>
        {preview.map((block) => (
          <p className={PANEL_LINE} key={block}>{block.split('\n').join(' ')}</p>
        ))}
        {remaining > 0 && <p className={PANEL_MORE}>and {remaining} more</p>}
      </div>

      <p className={BODY}>
        Usually it is a blank line that slipped into the middle of a caption. Fix it in your file
        and start again with it to get everything in.
      </p>

      <AppDialogActions>
        <button type="button" className={BTN_PRIMARY_SM} onClick={() => setDismissed(blocks)}>
          Got it
        </button>
      </AppDialogActions>
    </AppDialog>
  );
}
