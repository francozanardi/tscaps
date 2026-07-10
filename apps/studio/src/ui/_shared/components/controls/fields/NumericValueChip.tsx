import { memo, useCallback, useRef, useState, type KeyboardEvent } from 'react';

interface NumericValueChipProps {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string | undefined;
  disabled?: boolean | undefined;
  ariaLabel: string;
  onChange: (value: number) => void;
}

function decimalsFromStep(step: number): number {
  if (step >= 1) return 0;
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

// Snap anchored at `min` so a `min` that isn't a multiple of `step`
// (e.g. -0.05 with step 0.005) still produces clean snapped values.
function clampSnap(value: number, min: number, max: number, step: number): number {
  const clamped = Math.max(min, Math.min(max, value));
  if (step <= 0) return clamped;
  const snapped = Math.round((clamped - min) / step) * step + min;
  return Math.max(min, Math.min(max, snapped));
}

const CHIP_BASE =
  'inline-flex items-baseline shrink-0 cursor-text ' +
  'border-b border-transparent transition-colors duration-quick ease-standard ' +
  'hover:border-edge-medium focus-within:border-accent focus-within:hover:border-accent';

const CHIP_DISABLED = 'inline-flex items-baseline shrink-0 opacity-40 cursor-not-allowed';

const INPUT_CLASS =
  'bg-transparent border-none outline-none p-0 m-0 text-right ' +
  'text-xs text-fg-secondary tabular-nums font-mono disabled:cursor-not-allowed';

const UNIT_CLASS = 'text-xs text-fg-faint tabular-nums font-mono pl-px select-none';

// Allows partial numeric input — every intermediate state while typing "-0.5"
// ("", "-", "-0", "-0.", "-0.5") must pass, not just the final form. Letters,
// symbols and a second dot/minus are rejected at the keystroke. We allow the
// leading `-` regardless of `min`: clampSnap clips it on commit, and policing
// it per-slider would block legitimate typing on negative-capable ranges.
const PARTIAL_NUMERIC = /^-?\d*\.?\d*$/;

/**
 * Inline editable numeric readout with an optional unit suffix. Reads as a
 * quiet right-aligned value at rest — no chrome. Hover reveals a hairline
 * underline; focus swaps the underline to the accent.
 *
 * The typed string only commits on blur or Enter; Escape reverts. Arrow
 * up/down nudge by `step` and commit immediately. Out-of-range or
 * unparseable input snaps back to the last valid value.
 */
export const NumericValueChip = memo(function NumericValueChip({
  value,
  min,
  max,
  step,
  unit,
  disabled,
  ariaLabel,
  onChange,
}: NumericValueChipProps) {
  const decimals = decimalsFromStep(step);
  const display = value.toFixed(decimals);

  // `null` = not editing → input mirrors `display` derived from the prop.
  // A non-null draft is the in-flight typed string and takes precedence, so
  // an upstream value change (slider drag, debounced parent update) can't
  // stomp it mid-edit.
  const [draft, setDraft] = useState<string | null>(null);
  // Snapshot of the draft at focus time. A blur without any keystroke leaves
  // the draft equal to this snapshot — committing then would round the value
  // to the step's decimals (e.g. baseline 4.55 → display "4.6" → commit 4.6),
  // synthesizing an override the user never asked for.
  const draftAtFocusRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitDraft = useCallback((raw: string) => {
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed)) return;
    const next = clampSnap(parsed, min, max, step);
    if (next !== value) onChange(next);
  }, [value, min, max, step, onChange]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(null);
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const parsed = parseFloat(draft ?? display);
      const base = Number.isFinite(parsed) ? parsed : value;
      const delta = e.key === 'ArrowUp' ? step : -step;
      const next = clampSnap(base + delta, min, max, step);
      setDraft(next.toFixed(decimals));
      onChange(next);
    }
  }, [draft, display, value, min, max, step, decimals, onChange]);

  // Input width is sized to the widest possible static value (the longest of
  // min/max in their decimal form), so the slider track keeps a stable
  // flex share whether the value is "1.0" or "-0.050". `ch` is exact under
  // `font-mono`. When the user types something longer the text scrolls
  // inside the fixed width — matches Figma / DAW number fields.
  const widthCh = Math.max(min.toFixed(decimals).length, max.toFixed(decimals).length, 1);

  const chipClass = disabled ? CHIP_DISABLED : CHIP_BASE;

  return (
    <label className={chipClass}>
      <input
        ref={inputRef}
        type="text"
        inputMode={decimals === 0 ? 'numeric' : 'decimal'}
        className={INPUT_CLASS}
        style={{ width: `${widthCh}ch` }}
        value={draft ?? display}
        disabled={disabled}
        aria-label={ariaLabel}
        onFocus={(e) => {
          setDraft(display);
          draftAtFocusRef.current = display;
          e.currentTarget.select();
        }}
        onChange={(e) => {
          const next = e.target.value;
          if (PARTIAL_NUMERIC.test(next)) setDraft(next);
        }}
        onBlur={() => {
          if (draft !== null && draft !== draftAtFocusRef.current) commitDraft(draft);
          setDraft(null);
          draftAtFocusRef.current = null;
        }}
        onKeyDown={onKeyDown}
      />
      {unit !== undefined && unit !== '' && <span className={UNIT_CLASS}>{unit}</span>}
    </label>
  );
});
