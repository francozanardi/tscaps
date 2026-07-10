import { useState, type ReactNode } from 'react';
import type {
  ExportResolution,
  ExportVideoOptions,
} from '@core/export/actions/ExportVideoAction';
import type { ResolutionCatalog } from '@presentation/export/services/ExportResolutionPresets';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { AsyncButton } from '@ui/_shared/components/AsyncButton/AsyncButton';
import { BTN_PRIMARY_SM, BTN_SECONDARY_SM } from '@ui/_shared/styles/buttons';

export interface ResolutionView {
  readonly catalog: ResolutionCatalog;
  /** `true` when the catalog steered the default off `'original'`. */
  readonly verticalDownscaleApplied: boolean;
  /** Human-readable description of the source's resolution (e.g. `'FHD · 1920 × 1080'`). */
  readonly sourceDescription: string;
}

interface ExportSettingsFormProps {
  defaults: Pick<ExportVideoOptions, 'format' | 'quality'>;
  resolutionView: ResolutionView;
  extraNotice?: ReactNode;
  onConfirm: (options: ExportVideoOptions) => Promise<void> | void;
  onCancel: () => void;
}

interface FormatMeta {
  readonly value: ExportVideoOptions['format'];
  readonly label: string;
  readonly hint: string;
  readonly codecInfo: string;
}

const FORMAT_OPTIONS: ReadonlyArray<FormatMeta> = [
  {
    value: 'mp4',
    label: 'MP4',
    hint: 'Universal compatibility. Recommended for most uses.',
    codecInfo:
      'MP4 container. The video codec is auto-selected for the best quality your browser ' +
      'can encode (typically H.264). Source audio is kept when compatible, otherwise ' +
      're-encoded.',
  },
  {
    value: 'webm',
    label: 'WebM',
    hint: 'Smaller files, less universal playback.',
    codecInfo:
      'WebM container. The video codec is auto-selected for the best quality your browser ' +
      'can encode (typically VP9 or AV1). Source audio is kept when compatible, otherwise ' +
      're-encoded.',
  },
];

interface QualityMeta {
  readonly value: ExportVideoOptions['quality'];
  readonly label: string;
  readonly hint: string;
}

const QUALITY_OPTIONS: ReadonlyArray<QualityMeta> = [
  { value: 'low', label: 'Low', hint: 'Fastest, smallest file.' },
  { value: 'medium', label: 'Medium', hint: 'Balanced.' },
  { value: 'high', label: 'High', hint: 'Recommended for most uploads.' },
  { value: 'very-high', label: 'Very High', hint: 'Largest file, slowest.' },
];

const LABEL = 'block text-xs font-semibold text-fg-secondary mb-1.5 tracking-[-0.005em]';
const SELECT =
  'w-full bg-surface-1 border border-edge-medium rounded-xs px-3 py-2 text-sm text-fg-primary ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:border-edge-strong ' +
  'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30';
const HINT = 'mt-1.5 text-xs text-fg-faint';

function sameResolution(a: ExportResolution, b: ExportResolution): boolean {
  if (a === 'original' || b === 'original') return a === b;
  return a.width === b.width && a.height === b.height;
}

export function ExportSettingsForm({
  defaults,
  resolutionView,
  extraNotice,
  onConfirm,
  onCancel,
}: ExportSettingsFormProps) {
  const { catalog, verticalDownscaleApplied, sourceDescription } = resolutionView;

  const [format, setFormat] = useState<ExportVideoOptions['format']>(defaults.format);
  const [quality, setQuality] = useState<ExportVideoOptions['quality']>(defaults.quality);
  const [resolution, setResolution] = useState<ExportResolution>(catalog.defaultResolution);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const currentOption =
    catalog.options.find((o) => sameResolution(o.resolution, resolution)) ?? catalog.options[0]!;
  const hasResolutionChoice = catalog.options.length > 1;
  const showVerticalHint = verticalDownscaleApplied
    && sameResolution(resolution, catalog.defaultResolution);

  const handleResolutionChange = (id: string) => {
    const option = catalog.options.find((o) => o.id === id);
    if (option) setResolution(option.resolution);
  };

  return (
    <div className="flex flex-col gap-4">
      {hasResolutionChoice ? (
        <ResolutionField
          options={catalog.options}
          currentId={currentOption.id}
          showVerticalHint={showVerticalHint}
          onChange={handleResolutionChange}
        />
      ) : (
        <ResolutionLegend sourceDescription={sourceDescription} />
      )}

      {extraNotice}

      <DisclosureSection
        title="Advanced options"
        open={advancedOpen}
        onToggle={() => setAdvancedOpen((v) => !v)}
      >
        <div className="flex flex-col gap-4">
          <FormatField format={format} onChange={setFormat} />
          <QualityField quality={quality} onChange={setQuality} />
        </div>
      </DisclosureSection>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className={BTN_SECONDARY_SM} onClick={onCancel}>Cancel</button>
        <AsyncButton
          className={BTN_PRIMARY_SM}
          onClick={() => onConfirm({ format, quality, resolution })}
          autoFocus
        >
          Export video
        </AsyncButton>
      </div>
    </div>
  );
}

function ResolutionField({
  options,
  currentId,
  showVerticalHint,
  onChange,
}: {
  options: ResolutionCatalog['options'];
  currentId: string;
  showVerticalHint: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className={LABEL} htmlFor="export-resolution">Resolution</label>
      <select
        id="export-resolution"
        className={SELECT}
        value={currentId}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
      <p className={HINT}>Output keeps your video&apos;s frame rate.</p>
      {showVerticalHint && (
        <p className="mt-1 text-xs text-fg-faint">
          Vertical videos default to 1080p for social-media exports.
        </p>
      )}
    </div>
  );
}

function ResolutionLegend({ sourceDescription }: { sourceDescription: string }) {
  return (
    <div>
      <p className={LABEL}>Resolution</p>
      <p className="text-sm text-fg-primary">{sourceDescription}</p>
      <p className={HINT}>Exports at the source resolution. Frame rate is preserved.</p>
    </div>
  );
}

function FormatField({
  format,
  onChange,
}: {
  format: ExportVideoOptions['format'];
  onChange: (next: ExportVideoOptions['format']) => void;
}) {
  const formatMeta = FORMAT_OPTIONS.find((o) => o.value === format) ?? FORMAT_OPTIONS[0]!;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label
          className="text-xs font-semibold text-fg-secondary tracking-[-0.005em]"
          htmlFor="export-format"
        >
          Format
        </label>
        <Tooltip text={formatMeta.codecInfo}>
          <button
            type="button"
            aria-label="About this format"
            className={
              'inline-flex items-center justify-center w-3.5 h-3.5 rounded-pill ' +
              'border border-edge-medium text-fg-faint text-[9px] leading-none ' +
              'hover:border-edge-strong hover:text-fg-secondary ' +
              'transition-colors duration-quick ease-standard cursor-help'
            }
          >
            i
          </button>
        </Tooltip>
      </div>
      <select
        id="export-format"
        className={SELECT}
        value={format}
        onChange={(e) => onChange(e.target.value as ExportVideoOptions['format'])}
      >
        {FORMAT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p className={HINT}>{formatMeta.hint}</p>
    </div>
  );
}

function QualityField({
  quality,
  onChange,
}: {
  quality: ExportVideoOptions['quality'];
  onChange: (next: ExportVideoOptions['quality']) => void;
}) {
  const qualityHint = QUALITY_OPTIONS.find((o) => o.value === quality)?.hint ?? '';
  return (
    <div>
      <label className={LABEL} htmlFor="export-quality">Quality</label>
      <select
        id="export-quality"
        className={SELECT}
        value={quality}
        onChange={(e) => onChange(e.target.value as ExportVideoOptions['quality'])}
      >
        {QUALITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p className={HINT}>{qualityHint}</p>
    </div>
  );
}

function DisclosureSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={
          'flex items-center gap-1.5 text-xs font-semibold text-fg-secondary tracking-[-0.005em] ' +
          'hover:text-fg-primary transition-colors duration-quick ease-standard ' +
          'cursor-pointer self-start'
        }
      >
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`transition-transform duration-quick ease-standard ${open ? 'rotate-90' : ''}`}
        >
          <path d="M3 1.5L6.5 5L3 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {title}
      </button>
      {open && <div className="mt-3 animate-fade-in">{children}</div>}
    </div>
  );
}
