import type { TranscribePreference } from '@core/transcription/domain/TranscribePreference';
import { ChevronDownIcon } from '@ui/_shared/components/icons/ChevronDownIcon';
import { ChevronRightIcon } from '@ui/_shared/components/icons/ChevronRightIcon';
import { SelectField, type SelectFieldOption } from '@ui/pages/editor/features/preprocessing/components/SelectField';

type Preference = TranscribePreference;
type Backend = Preference['backend'];
type Model = Preference['model'];

interface BackendOption extends SelectFieldOption {
  readonly value: Backend;
  readonly hint: string;
}

const BACKENDS: readonly BackendOption[] = [
  { value: 'wasm',   label: 'CPU', hint: 'Default — works on every device.' },
  { value: 'webgpu', label: 'GPU', hint: 'Faster on modern GPUs. May not work on older hardware.' },
];

interface ModelOption extends SelectFieldOption {
  readonly value: Model;
}

const MODELS: readonly ModelOption[] = [
  { value: 'tiny',  label: 'Tiny — ~40 MB' },
  { value: 'base',  label: 'Base — ~75 MB' },
  { value: 'small', label: 'Small — ~250 MB' },
];

const TOGGLE_CLS =
  'flex items-center gap-1 text-xs text-fg-muted cursor-pointer self-start bg-transparent border-0 p-0 ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:text-fg-secondary focus-visible:outline-none focus-visible:text-fg-secondary';

interface AdvancedSectionProps {
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly preference: Preference;
  readonly onPreferenceChange: (pref: Preference) => void;
}

export function AdvancedSection({ open, onToggle, preference, onPreferenceChange }: AdvancedSectionProps) {
  const backendHint = BACKENDS.find((o) => o.value === preference.backend)?.hint;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={TOGGLE_CLS}
        onClick={onToggle}
        aria-expanded={open}
      >
        {open ? <ChevronDownIcon width={12} height={12} /> : <ChevronRightIcon width={12} height={12} />}
        Advanced
      </button>
      {open && (
        <div className="flex flex-col gap-3 pl-4 border-l border-edge-subtle">
          <SelectField
            id="td-backend"
            label="Backend"
            value={preference.backend}
            options={BACKENDS}
            onChange={(value) => onPreferenceChange({ ...preference, backend: value as Backend })}
            hint={backendHint}
          />
          <SelectField
            id="td-model"
            label="Model"
            value={preference.model}
            options={MODELS}
            onChange={(value) => onPreferenceChange({ ...preference, model: value as Model })}
            hint="Larger models give better accuracy but take longer to download and run."
          />
        </div>
      )}
    </div>
  );
}
