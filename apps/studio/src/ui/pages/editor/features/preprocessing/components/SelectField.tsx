import type { ReactNode } from 'react';

export interface SelectFieldOption {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectFieldOption[];
  readonly onChange: (value: string) => void;
  readonly hint?: ReactNode;
}

const LABEL_CLS = 'block text-xs text-fg-secondary mb-1.5 tracking-[-0.005em]';

const SELECT_CLS =
  'w-full box-border bg-surface-1 border border-edge-medium rounded-xs text-fg-primary text-sm py-2 px-3 cursor-pointer ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:border-edge-strong ' +
  'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30';

const HINT_CLS = 'text-2xs text-fg-faint m-0 mt-1.5 leading-snug';

export function SelectField({ id, label, value, options, onChange, hint }: SelectFieldProps) {
  return (
    <div>
      <label className={LABEL_CLS} htmlFor={id}>{label}</label>
      <select
        id={id}
        className={SELECT_CLS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {hint != null && <p className={HINT_CLS}>{hint}</p>}
    </div>
  );
}
