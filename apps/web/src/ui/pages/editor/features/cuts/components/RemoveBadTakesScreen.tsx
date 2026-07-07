import { useMemo } from 'react';
import type { Document } from '@tscaps/engine';
import type { CutRegistry, CutRange } from '@core/cuts/domain/CutRegistry';
import { useCuts } from '@ui/_shared/contexts/modules/CutsContext';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';

const SCREEN_CLASS = 'p-2 flex flex-col gap-2 w-[240px] box-border';
const EMPTY_HELPER_CLASS = 'text-2xs text-fg-faint m-0 text-center';

interface RemoveBadTakesScreenProps {
  document: Document;
  videoDurationSec: number;
  cuts: CutRegistry;
  onRemoveBadTakes: (ranges: ReadonlyArray<CutRange>) => void;
}

/**
 * Popover screen for the auto remove-bad-takes feature. Derives the
 * ranges produced by the bad-take finder (consecutive `cut`-tagged
 * words and the silence trapped between them) and offers a single
 * action that commits the ones not already covered by an existing
 * cut. The popover stays open after the action so the user can run
 * the silence flow next without re-opening.
 */
export function RemoveBadTakesScreen({
  document,
  videoDurationSec,
  cuts,
  onRemoveBadTakes,
}: RemoveBadTakesScreenProps) {
  const { badTakeFinder } = useCuts().services;
  const removableRanges = useMemo(() => {
    const all = badTakeFinder.find(document, videoDurationSec);
    return all.filter((range) => !cuts.containsTimeRange(range.startSec, range.endSec));
  }, [badTakeFinder, document, videoDurationSec, cuts]);

  const count = removableRanges.length;
  const disabled = count === 0;
  const removeLabel = count === 1 ? 'Remove 1 bad take' : `Remove ${count} bad takes`;

  return (
    <div className={SCREEN_CLASS}>
      <PopoverHeader title="Remove bad takes" />
      <button
        type="button"
        className={BTN_PRIMARY_SM}
        onClick={() => onRemoveBadTakes(removableRanges)}
        disabled={disabled}
      >
        {removeLabel}
      </button>
      {disabled && (
        <p className={EMPTY_HELPER_CLASS}>No bad takes found.</p>
      )}
    </div>
  );
}
