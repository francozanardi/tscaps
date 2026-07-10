import { useMemo, useState } from 'react';
import type { Document } from '@tscaps/engine';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { Silence } from '@core/cuts/domain/Silence';
import type { RemoveSilencesPreset } from '@core/cuts/domain/RemoveSilencesPreset';
import { useCuts } from '@ui/_shared/contexts/modules/CutsContext';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { BTN_PRIMARY_SM } from '@ui/_shared/styles/buttons';

const PRESETS: ReadonlyArray<{ value: RemoveSilencesPreset; label: string }> = [
  { value: 'natural', label: 'Natural' },
  { value: 'fast', label: 'Fast' },
  { value: 'faster', label: 'Faster' },
];

const SCREEN_CLASS = 'p-2 flex flex-col gap-2 w-[240px] box-border';

const SWITCH_GROUP_CLASS =
  'flex rounded-xs border border-edge-medium bg-surface-2 p-[2px] gap-[2px] self-stretch';

const SWITCH_BUTTON_BASE =
  'flex-1 flex items-center justify-center px-2 py-1 rounded-xs text-xs cursor-pointer '
  + 'transition-colors duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30';

const SWITCH_BUTTON_ACTIVE =
  `${SWITCH_BUTTON_BASE} bg-accent/20 text-fg-primary border border-accent`;

const SWITCH_BUTTON_INACTIVE =
  `${SWITCH_BUTTON_BASE} bg-transparent text-fg-secondary border border-transparent hover:bg-surface-3`;

const EMPTY_HELPER_CLASS = 'text-2xs text-fg-faint m-0 text-center';

interface RemoveSilencesScreenProps {
  document: Document;
  videoDurationSec: number;
  cuts: CutRegistry;
  onRemoveSilences: (silences: ReadonlyArray<Silence>) => void;
}

/**
 * Popover screen for the auto remove-silences feature. Owns the local
 * preset selection, derives the count of silences that would actually
 * change the registry (those not already inside a stored cut), and
 * commits them as a batch. The popover stays open after the action so
 * the user can iterate across presets and see the count drop to zero.
 */
export function RemoveSilencesScreen({
  document,
  videoDurationSec,
  cuts,
  onRemoveSilences,
}: RemoveSilencesScreenProps) {
  const { silenceFinder } = useCuts().services;
  const [preset, setPreset] = useState<RemoveSilencesPreset>('fast');
  const removableSilences = useMemo(() => {
    const all = silenceFinder.findForPreset(document, videoDurationSec, preset);
    return all.filter((silence) => !cuts.containsTimeRange(silence.range.startSec, silence.range.endSec));
  }, [silenceFinder, document, videoDurationSec, preset, cuts]);

  const count = removableSilences.length;
  const disabled = count === 0;
  const removeLabel = count === 1 ? 'Remove 1 silence' : `Remove ${count} silences`;

  return (
    <div className={SCREEN_CLASS}>
      <PopoverHeader title="Remove silences" />
      <div className={SWITCH_GROUP_CLASS} role="tablist" aria-label="Remove silences intensity">
        {PRESETS.map((option) => {
          const active = option.value === preset;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? SWITCH_BUTTON_ACTIVE : SWITCH_BUTTON_INACTIVE}
              onClick={() => setPreset(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={BTN_PRIMARY_SM}
        onClick={() => onRemoveSilences(removableSilences)}
        disabled={disabled}
      >
        {removeLabel}
      </button>
      {disabled && (
        <p className={EMPTY_HELPER_CLASS}>No silences found with current settings.</p>
      )}
    </div>
  );
}
