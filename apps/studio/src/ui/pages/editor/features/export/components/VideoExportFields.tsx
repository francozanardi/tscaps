import type {
  ExportResolution,
  ExportVideoOptions,
} from '@core/export/actions/ExportVideoAction';
import type { ResolutionCatalog } from '@presentation/export/services/ExportResolutionPresets';
import { InfoTip } from '@ui/pages/editor/features/export/components/InfoTip';
import {
  FIELD_HINT,
  FIELD_LABEL,
  FIELD_SELECT,
} from '@ui/_shared/styles/formFields';

/* The fields every settings view that renders a video shares: where the
   output's size, container and quality are chosen. */

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

export function sameResolution(a: ExportResolution, b: ExportResolution): boolean {
  if (a === 'original' || b === 'original') return a === b;
  return a.width === b.width && a.height === b.height;
}

export function ResolutionField({
  options,
  currentId,
  showVerticalHint,
  cappedNote,
  onChange,
}: {
  options: ResolutionCatalog['options'];
  currentId: string;
  showVerticalHint: boolean;
  /** Why the choice moved, when something moved it. */
  cappedNote: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className={FIELD_LABEL} htmlFor="export-resolution">Resolution</label>
      <select
        id="export-resolution"
        className={FIELD_SELECT}
        value={currentId}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
      <p className={FIELD_HINT}>Output keeps your video&apos;s frame rate.</p>
      {showVerticalHint && (
        <p className="mt-1 text-xs text-fg-faint">
          Vertical videos default to 1080p for social-media exports.
        </p>
      )}
      {cappedNote && <p className="mt-1 text-xs text-fg-faint">{cappedNote}</p>}
    </div>
  );
}

export function ResolutionLegend({ sourceDescription }: { sourceDescription: string }) {
  return (
    <div>
      <p className={FIELD_LABEL}>Resolution</p>
      <p className="text-sm text-fg-primary">{sourceDescription}</p>
      <p className={FIELD_HINT}>Exports at the source resolution. Frame rate is preserved.</p>
    </div>
  );
}

export function FormatField({
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
        <InfoTip text={formatMeta.codecInfo} label="About this format" />
      </div>
      <select
        id="export-format"
        className={FIELD_SELECT}
        value={format}
        onChange={(e) => onChange(e.target.value as ExportVideoOptions['format'])}
      >
        {FORMAT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p className={FIELD_HINT}>{formatMeta.hint}</p>
    </div>
  );
}

export function QualityField({
  quality,
  onChange,
}: {
  quality: ExportVideoOptions['quality'];
  onChange: (next: ExportVideoOptions['quality']) => void;
}) {
  const qualityHint = QUALITY_OPTIONS.find((o) => o.value === quality)?.hint ?? '';
  return (
    <div>
      <label className={FIELD_LABEL} htmlFor="export-quality">Quality</label>
      <select
        id="export-quality"
        className={FIELD_SELECT}
        value={quality}
        onChange={(e) => onChange(e.target.value as ExportVideoOptions['quality'])}
      >
        {QUALITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p className={FIELD_HINT}>{qualityHint}</p>
    </div>
  );
}
