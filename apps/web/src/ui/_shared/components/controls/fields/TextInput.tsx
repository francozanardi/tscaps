import { memo } from 'react';

interface TextInputProps {
  label: string;
  value: string;
  disabled?: boolean | undefined;
  onChange: (value: string) => void;
}

const INPUT_CLS =
  'flex-1 min-w-0 h-[26px] px-2 text-xs text-fg-secondary bg-surface-2 border border-edge-medium rounded-xs outline-none ' +
  'transition-colors duration-quick ease-standard ' +
  'enabled:hover:border-edge-strong ' +
  'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * Single-line text input matching the slider/toggle row layout. Commits on
 * every keystroke; the styling pipeline already re-renders per frame in
 * letter-mode templates, so debouncing wouldn't save any work.
 */
export const TextInput = memo(function TextInput({
  label,
  value,
  disabled,
  onChange,
}: TextInputProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-fg-muted min-w-[90px] shrink-0">{label}</span>
      <input
        type="text"
        className={INPUT_CLS}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
});
