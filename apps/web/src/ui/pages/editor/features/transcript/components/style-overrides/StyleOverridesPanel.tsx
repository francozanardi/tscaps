import { Fragment, useCallback, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';

/**
 * Per-field props injected by `StyleOverridesPanel` into each field render
 * function. `current` is the raw override map (only fields the user actually
 * changed); `baseline` is the sheet-level fallback used to compute the
 * effective value for display and to drop fields that match it on commit.
 */
export interface StyleOverrideFieldContext<T extends object> {
  current: T;
  baseline: Partial<T>;
  commit: (patch: Partial<T>) => void;
}

export type StyleOverrideField<T extends object> =
  (ctx: StyleOverrideFieldContext<T>) => ReactNode;

interface StyleOverridesPanelProps<T extends object> {
  title: string;
  current: T;
  baseline: Partial<T>;
  fields: ReadonlyArray<StyleOverrideField<T>>;
  onCommit: (next: T) => void;
}

const ICON_BTN =
  'flex items-center justify-center w-5 h-5 rounded-xs border-none bg-transparent text-fg-faint cursor-pointer ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:text-fg-secondary hover:bg-surface-3 ' +
  'focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-secondary';

const EMPTY: Record<string, never> = {};

/**
 * Field-driven shell for per-target style overrides. The panel handles the
 * universal pieces — layout, header + reset button, and the
 * "drop-fields-equal-to-baseline" cleaning on every commit — and delegates
 * the actual rows to render functions in `fields`. Each field receives the
 * raw `current` overrides plus the `baseline` it should fall back to.
 *
 * Cleaning rule: a field is dropped from the cleaned record when its value
 * is `undefined` OR when the value matches `baseline[key]` by reference
 * equality. For composite fields (e.g. a position block) the field is
 * responsible for computing equality itself and committing `undefined` when
 * its value matches baseline — keeping the panel's logic per-key.
 */
export function StyleOverridesPanel<T extends object>({
  title,
  current,
  baseline,
  fields,
  onCommit,
}: StyleOverridesPanelProps<T>) {
  const hasOverrides = Object.keys(current).length > 0;

  const commit = useCallback((patch: Partial<T>) => {
    const next: T = { ...current, ...patch };
    const cleaned: Record<string, unknown> = {};
    for (const key of Object.keys(next) as Array<keyof T>) {
      const v = next[key];
      if (v === undefined) continue;
      if (key in baseline && baseline[key] === v) continue;
      cleaned[key as string] = v;
    }
    onCommit(cleaned as T);
  }, [current, baseline, onCommit]);

  const reset = hasOverrides ? (
    <button
      type="button"
      className={ICON_BTN}
      title="Reset overrides"
      aria-label="Reset style overrides"
      onClick={() => onCommit(EMPTY as T)}
    >
      <RotateCcw size={11} />
    </button>
  ) : undefined;

  return (
    <div className="p-2 flex flex-col gap-2 w-[240px] box-border">
      <PopoverHeader title={title} action={reset} />
      {fields.map((field, i) => (
        <Fragment key={i}>{field({ current, baseline, commit })}</Fragment>
      ))}
    </div>
  );
}
