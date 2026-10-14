import { useState, type ReactNode } from 'react';
import type {
  ExportResolution,
  ExportVideoOptions,
} from '@core/export/actions/ExportVideoAction';
import { ColorPicker } from '@ui/_shared/components/controls/fields/ColorPicker';
import { Toggle } from '@ui/_shared/components/controls/fields/Toggle';
import { DisclosureSection } from '@ui/pages/editor/features/export/components/DisclosureSection';
import { ExportSettingsFooter } from '@ui/pages/editor/features/export/components/ExportSettingsFooter';
import type { ResolutionView } from '@ui/pages/editor/features/export/components/VideoExportSettings';
import {
  FormatField,
  QualityField,
  ResolutionField,
  ResolutionLegend,
  sameResolution,
} from '@ui/pages/editor/features/export/components/VideoExportFields';
import {
  FIELD_HINT,
  FIELD_LABEL,
  FIELD_SELECT,
} from '@ui/_shared/styles/formFields';

interface CaptionsOnlyExportSettingsProps {
  defaults: Pick<ExportVideoOptions, 'format' | 'quality'>;
  resolutionView: ResolutionView;
  /** Whether some caption style reads the video, which this export leaves out. */
  dependsOnVideo: boolean;
  extraNotice?: ReactNode;
  onConfirm: (options: ExportVideoOptions) => Promise<void> | void;
  onBack: () => void;
  onCancel: () => void;
}

type CaptionsOnlyBackground = 'transparent' | 'color';

interface BackgroundMeta {
  readonly value: CaptionsOnlyBackground;
  readonly label: string;
  readonly hint: string;
}

const BACKGROUND_OPTIONS: ReadonlyArray<BackgroundMeta> = [
  {
    value: 'transparent',
    label: 'Transparent',
    hint: 'Exports a WebM file (VP9) with transparency. Some video editors need a plugin to read transparency in WebM.',
  },
  {
    value: 'color',
    label: 'Solid color',
    hint: 'Remove the color with a chroma key in your video editor.',
  },
];

const DEFAULT_KEY_COLOR = '#00ff00';

/**
 * Settings for rendering the captions without the video, for people
 * who finish the video in another editor. The video still sets the
 * size, frame rate and length, so the file lines up with it.
 */
export function CaptionsOnlyExportSettings({
  defaults,
  resolutionView,
  dependsOnVideo,
  extraNotice,
  onConfirm,
  onBack,
  onCancel,
}: CaptionsOnlyExportSettingsProps) {
  const { catalog, verticalDownscaleApplied, sourceDescription } = resolutionView;

  const [background, setBackground] = useState<CaptionsOnlyBackground>('transparent');
  const [color, setColor] = useState(DEFAULT_KEY_COLOR);
  const [keepAudio, setKeepAudio] = useState(true);
  const [resolution, setResolution] = useState<ExportResolution>(catalog.defaultResolution);
  const [format, setFormat] = useState<ExportVideoOptions['format']>(defaults.format);
  const [quality, setQuality] = useState<ExportVideoOptions['quality']>(defaults.quality);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const currentOption =
    catalog.options.find((o) => sameResolution(o.resolution, resolution)) ?? catalog.options[0]!;
  const backgroundMeta = BACKGROUND_OPTIONS.find((o) => o.value === background) ?? BACKGROUND_OPTIONS[0]!;

  const handleResolutionChange = (id: string) => {
    const option = catalog.options.find((o) => o.id === id);
    if (option) setResolution(option.resolution);
  };

  const handleConfirm = () => onConfirm({
    // Only WebM carries transparency.
    format: background === 'transparent' ? 'webm' : format,
    quality,
    resolution,
    background: background === 'transparent' ? { kind: 'transparent' } : { kind: 'color', color },
    audio: keepAudio ? 'keep' : 'discard',
  });

  return (
    <div className="flex flex-col gap-4">
      {dependsOnVideo && <VideoDependentStyleWarning />}

      <div>
        <label className={FIELD_LABEL} htmlFor="export-background">Background</label>
        <select
          id="export-background"
          className={FIELD_SELECT}
          value={background}
          onChange={(e) => setBackground(e.target.value as CaptionsOnlyBackground)}
        >
          {BACKGROUND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className={FIELD_HINT}>{backgroundMeta.hint}</p>
      </div>

      {background === 'color' && (
        <ColorPicker label="Background color" value={color} onChange={setColor} />
      )}

      <Toggle label="Include audio" value={keepAudio} onChange={setKeepAudio} />

      {catalog.options.length > 1 ? (
        <ResolutionField
          options={catalog.options}
          currentId={currentOption.id}
          showVerticalHint={verticalDownscaleApplied && sameResolution(resolution, catalog.defaultResolution)}
          cappedNote={null}
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
          {background === 'color' && <FormatField format={format} onChange={setFormat} />}
          <QualityField quality={quality} onChange={setQuality} />
        </div>
      </DisclosureSection>

      <ExportSettingsFooter
        alternateLabel="Back"
        confirmLabel="Export"
        onAlternate={onBack}
        onCancel={onCancel}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

/** Shown first, since it can change whether this export is what the reader wants. */
function VideoDependentStyleWarning() {
  return (
    <div role="status" className="rounded-sm border border-warning/40 bg-warning/10 p-3 flex flex-col gap-1.5">
      <p className="text-xs text-fg-primary leading-snug m-0">
        Some captions will look different without your video.
      </p>
      <p className="text-xs text-fg-secondary leading-snug m-0">
        Some styles in this project use your video, for example a blur or a blend. This export does not
        include the video. Blends are exported without the blend, so you can apply it again in your
        video editor.
      </p>
    </div>
  );
}
