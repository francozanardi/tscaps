import { useEffect, useMemo, useState } from 'react';
import type { Document } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SheetMatcher, SheetMatcherAvailability } from '@core/sheet-matchers/domain/SheetMatcher';
import type {
  SpeakerSheetMatcher,
  SpeakerSheetMatcherParams,
} from '@core/sheet-matchers/services/SpeakerSheetMatcher';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { AppDialog, AppDialogActions } from '@ui/_shared/components/Dialog/AppDialog';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';

interface AutoAssignDialogProps {
  open: boolean;
  document: Document;
  sheets: ReadonlyArray<Sheet>;
  /** Sheet preselected as the target. Falls back to the first sheet. */
  initialSheetId: string | null;
  onApply: <P>(sheetId: string, matcher: SheetMatcher<P>, params: P) => void;
  onCancel: () => void;
}

const SECTION_LABEL = 'block text-xs text-fg-secondary mb-1.5 tracking-[-0.005em]';
const SELECT =
  'w-full box-border bg-surface-1 border border-edge-medium rounded-xs text-fg-primary text-sm py-2 px-2.5 outline-none ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:border-edge-strong ' +
  'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30';
const LEGEND_UNAVAILABLE = 'mt-2 text-xs text-fg-secondary leading-snug';

const NO_SPEAKER_VALUE = '__no_speaker__';


interface MatcherSelection {
  matcher: SheetMatcher<unknown>;
  params: unknown;
}

/**
 * Maps an unavailable matcher's `code` to the user-facing legend the
 * dialog renders under the picker. Lookup is keyed by `matcher.type`
 * first so each matcher's codes stay isolated; new matcher → add a new
 * entry. Keeping this here (not in the matcher) is deliberate: the core
 * stays free of UI tab names and copy.
 */
const UNAVAILABLE_LEGENDS: Record<string, Record<string, string>> = {
  speaker: {
    'insufficient-speakers':
      'Grouping by speaker needs at least two speakers detected in the recording. This one has only one.',
    'mixed-speaker-segments':
      'Some scenes mix multiple speakers. Enable "Split scenes by speaker" in the Layout tab so each scene carries a single voice, then come back.',
  },
};

function legendFor(matcherType: string, code: string): string {
  return UNAVAILABLE_LEGENDS[matcherType]?.[code]
    ?? 'This matcher is not available in the current state.';
}

export function AutoAssignDialog({
  open,
  document,
  sheets,
  initialSheetId,
  onApply,
  onCancel,
}: AutoAssignDialogProps) {
  const { matcherRegistry: registry } = useSheets();

  const ctx = useMemo(() => ({ document, sheets }), [document, sheets]);
  const matchers = useMemo(() => registry.list(), [registry]);
  const availabilities = useMemo<ReadonlyMap<string, SheetMatcherAvailability>>(() => {
    const map = new Map<string, SheetMatcherAvailability>();
    for (const m of matchers) map.set(m.type, m.availability(ctx));
    return map;
  }, [matchers, ctx]);

  const visibleMatchers = matchers;

  const [sheetId, setSheetId] = useState<string>(() => initialSheetId ?? sheets[0]?.id ?? '');
  const [selection, setSelection] = useState<MatcherSelection | null>(() => {
    const first = visibleMatchers[0];
    return first ? { matcher: first, params: first.defaultParams(ctx) } : null;
  });

  // Re-seed selections on every open so the dialog reflects the current
  // document + sheet list rather than stale state from the prior open.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setSheetId(initialSheetId ?? sheets[0]?.id ?? '');
    const first = visibleMatchers[0];
    setSelection(first ? { matcher: first, params: first.defaultParams(ctx) } : null);
  }, [open, initialSheetId, sheets, visibleMatchers, ctx]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedAvailability = selection ? availabilities.get(selection.matcher.type) : undefined;
  const canApply = sheetId !== '' && selection !== null && selectedAvailability?.available === true;

  const handleApply = () => {
    if (!canApply || !selection) return;
    onApply(sheetId, selection.matcher, selection.params);
  };

  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      size="md"
      title="Group scenes"
      description="Send every scene that shares a property to a sheet at once, instead of assigning them one by one."
    >
      {matchers.length === 0 ? (
        <p className="text-sm text-fg-secondary">No grouping options are configured.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className={SECTION_LABEL} htmlFor="auto-assign-sheet">Send to sheet</label>
            <select
              id="auto-assign-sheet"
              className={SELECT}
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
            >
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {visibleMatchers.length > 0 && (
            <div>
              <label className={SECTION_LABEL} htmlFor="auto-assign-matcher">Group by</label>
              <select
                id="auto-assign-matcher"
                className={SELECT}
                value={selection?.matcher.type ?? ''}
                onChange={(e) => {
                  const next = visibleMatchers.find((m) => m.type === e.target.value);
                  if (!next) return;
                  setSelection({ matcher: next, params: next.defaultParams(ctx) });
                }}
              >
                {visibleMatchers.map((m) => {
                  const a = availabilities.get(m.type);
                  const suffix = a && !a.available ? ' (unavailable)' : '';
                  return (
                    <option key={m.type} value={m.type}>{m.label}{suffix}</option>
                  );
                })}
              </select>
              {selection && selectedAvailability && !selectedAvailability.available && (
                <p className={LEGEND_UNAVAILABLE}>
                  {legendFor(selection.matcher.type, selectedAvailability.code)}
                </p>
              )}
            </div>
          )}


          {selection?.matcher.type === 'speaker'
            && selectedAvailability?.available === true && (
            <SpeakerMatcherControls
              document={document}
              matcher={selection.matcher as SpeakerSheetMatcher}
              params={selection.params as SpeakerSheetMatcherParams}
              onChange={(params) => setSelection({ matcher: selection.matcher, params })}
            />
          )}
        </div>
      )}

      <AppDialogActions>
        <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className={BTN_PRIMARY_SM}
          onClick={handleApply}
          disabled={!canApply}
        >
          Group
        </button>
      </AppDialogActions>
    </AppDialog>
  );
}

interface SpeakerMatcherControlsProps {
  document: Document;
  matcher: SpeakerSheetMatcher;
  params: SpeakerSheetMatcherParams;
  onChange: (params: SpeakerSheetMatcherParams) => void;
}

function SpeakerMatcherControls({ document, matcher, params, onChange }: SpeakerMatcherControlsProps) {
  const ids = useMemo(() => matcher.collectSpeakerIds(document), [document, matcher]);
  const selected = params.speakerId === null ? NO_SPEAKER_VALUE : params.speakerId;

  return (
    <div>
      <label className={SECTION_LABEL} htmlFor="auto-assign-speaker">Speaker</label>
      <select
        id="auto-assign-speaker"
        className={SELECT}
        value={selected}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ speakerId: v === NO_SPEAKER_VALUE ? null : v });
        }}
      >
        {ids.map((id) => (
          <option key={id ?? NO_SPEAKER_VALUE} value={id ?? NO_SPEAKER_VALUE}>
            {id ?? 'No speaker'}
          </option>
        ))}
      </select>
    </div>
  );
}

