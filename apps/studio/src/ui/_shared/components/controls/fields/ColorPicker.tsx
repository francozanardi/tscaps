import { memo, useState } from 'react';
import { Copy, ClipboardPaste, Check } from 'lucide-react';
import { HexAlphaColorPicker } from 'react-colorful';
import { Popover } from '@ui/_shared/components/Popover/Popover';

interface ColorPickerProps {
  label: string;
  /** Accepts `#rrggbb` or `#rrggbbaa`. */
  value: string;
  disabled?: boolean | undefined;
  /** Emits `#rrggbb` when fully opaque, `#rrggbbaa` when alpha < 1. */
  onChange: (value: string) => void;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX8 = /^#[0-9a-fA-F]{8}$/;
const COPY_FEEDBACK_MS = 1000;

const CHECKER_LAYERS = [
  'linear-gradient(45deg, #777 25%, transparent 25%)',
  'linear-gradient(-45deg, #777 25%, transparent 25%)',
  'linear-gradient(45deg, transparent 75%, #777 75%)',
  'linear-gradient(-45deg, transparent 75%, #777 75%)',
].join(', ');

function normalizeHex(value: string): string {
  const lower = value.toLowerCase();
  if (HEX8.test(lower)) return lower;
  if (HEX6.test(lower)) return `${lower}ff`;
  return '#000000ff';
}

function rgbaString(hex8: string): string {
  const r = parseInt(hex8.slice(1, 3), 16);
  const g = parseInt(hex8.slice(3, 5), 16);
  const b = parseInt(hex8.slice(5, 7), 16);
  const a = parseInt(hex8.slice(7, 9), 16) / 255;
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Compact form of the canonical hex: `#rrggbb` when fully opaque, otherwise
 * `#rrggbbaa`. Keeps storage clean (defaults stay 6-char) and only writes
 * an alpha byte when the user actually picks transparency.
 */
function compactHex(hex8: string): string {
  return hex8.endsWith('ff') ? hex8.slice(0, 7) : hex8;
}

/**
 * Color swatch + label + copy/paste actions. Clicking the swatch opens a
 * Radix popover with a `react-colorful` alpha-aware picker — replaces the
 * native `<input type="color">` so we get consistent UX across browsers/OS,
 * touch support on mobile, and an alpha slider.
 *
 * The single `value` string carries alpha when present (`#rrggbbaa`); CSS
 * accepts both 6- and 8-digit hex natively, so consumers (templates,
 * effects, sheet overrides) need no changes.
 *
 * Copy/paste buttons fade in on hover or focus-within. Parent (e.g.
 * `FieldsSection`) lays multiple ColorPickers in an auto-fill grid that
 * packs as many swatches per row as the available width allows.
 */
export const ColorPicker = memo(function ColorPicker({
  label,
  value,
  disabled,
  onChange,
}: ColorPickerProps) {
  const hex8 = normalizeHex(value);
  const displayHex = compactHex(hex8);

  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayHex);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard write blocked — silently no-op.
    }
  };

  const handlePaste = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim().toLowerCase();
      if (HEX8.test(text)) onChange(compactHex(text));
      else if (HEX6.test(text)) onChange(text);
    } catch {
      // Clipboard read blocked or empty — silently no-op.
    }
  };

  const handlePickerChange = (next: string) => {
    onChange(compactHex(normalizeHex(next)));
  };

  const swatchStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(${rgbaString(hex8)}, ${rgbaString(hex8)}), ${CHECKER_LAYERS}`,
    backgroundSize: '100% 100%, 8px 8px, 8px 8px, 8px 8px, 8px 8px',
    backgroundPosition: '0 0, 0 0, 0 4px, 4px -4px, -4px 0',
  };

  const trigger = (
    <button
      type="button"
      className="w-[26px] h-[26px] rounded-xs border border-edge-medium cursor-pointer p-0 shrink-0 transition-colors duration-quick ease-standard hover:border-edge-strong focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
      style={swatchStyle}
      disabled={disabled}
      aria-label={label ? `Pick ${label} color` : 'Pick color'}
    />
  );

  const panel = (
    <div className="p-2 flex flex-col gap-2 box-border">
      <HexAlphaColorPicker color={hex8} onChange={handlePickerChange} />
      <div className="text-2xs text-fg-muted font-mono text-center select-all">{displayHex}</div>
    </div>
  );

  return (
    <div className="group/color flex items-center gap-[7px]">
      <Popover
        open={open && !disabled}
        onOpenChange={setOpen}
        trigger={trigger}
        screens={{ panel }}
      />
      <span className="text-xs text-fg-muted whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
        {label}
      </span>
      <div className="flex gap-0.5 opacity-0 group-hover/color:opacity-100 group-focus-within/color:opacity-100 transition-opacity duration-quick ease-standard">
        <button
          type="button"
          className="w-[18px] h-[18px] inline-flex items-center justify-center bg-transparent border-none rounded-xs text-fg-muted cursor-pointer p-0 shrink-0 transition-colors duration-quick ease-standard enabled:hover:bg-surface-3 enabled:hover:text-fg-secondary focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          title={copied ? 'Copied' : `Copy ${displayHex}`}
          aria-label={copied ? 'Copied' : `Copy ${label} color`}
          onClick={handleCopy}
          disabled={disabled}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
        <button
          type="button"
          className="w-[18px] h-[18px] inline-flex items-center justify-center bg-transparent border-none rounded-xs text-fg-muted cursor-pointer p-0 shrink-0 transition-colors duration-quick ease-standard enabled:hover:bg-surface-3 enabled:hover:text-fg-secondary focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
          title="Paste hex from clipboard"
          aria-label={`Paste ${label} color from clipboard`}
          onClick={handlePaste}
          disabled={disabled}
        >
          <ClipboardPaste size={11} />
        </button>
      </div>
    </div>
  );
});
