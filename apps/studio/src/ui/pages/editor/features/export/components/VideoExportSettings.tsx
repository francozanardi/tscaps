import { useState, type ReactNode } from 'react';
import type {
  ExportResolution,
  ExportVideoOptions,
} from '@core/export/actions/ExportVideoAction';
import type { ResolutionCatalog } from '@presentation/export/services/ExportResolutionPresets';
import { DisclosureSection } from '@ui/pages/editor/features/export/components/DisclosureSection';
import { ExportSettingsFooter } from '@ui/pages/editor/features/export/components/ExportSettingsFooter';
import {
  FormatField,
  QualityField,
  ResolutionField,
  ResolutionLegend,
  sameResolution,
} from '@ui/pages/editor/features/export/components/VideoExportFields';

export interface ResolutionView {
  readonly catalog: ResolutionCatalog;
  /** `true` when the catalog steered the default off `'original'`. */
  readonly verticalDownscaleApplied: boolean;
  /** Human-readable description of the source's resolution (e.g. `'FHD · 1920 × 1080'`). */
  readonly sourceDescription: string;
}

interface VideoExportSettingsProps {
  defaults: Pick<ExportVideoOptions, 'format' | 'quality'>;
  resolutionView: ResolutionView;
  extraNotice?: ReactNode;
  onConfirm: (options: ExportVideoOptions) => Promise<void> | void;
  /** Leads to the rarer exports: a subtitle file, or the captions as a video of their own. */
  onSwitchToOtherFormats: () => void;
  onCancel: () => void;
}

/**
 * Settings for burning the captions into the video, the errand almost
 * everyone opens this dialog for.
 */
export function VideoExportSettings({
  defaults,
  resolutionView,
  extraNotice,
  onConfirm,
  onSwitchToOtherFormats,
  onCancel,
}: VideoExportSettingsProps) {
  const { catalog, verticalDownscaleApplied, sourceDescription } = resolutionView;

  const [format, setFormat] = useState<ExportVideoOptions['format']>(defaults.format);
  const [quality, setQuality] = useState<ExportVideoOptions['quality']>(defaults.quality);
  const [resolution, setResolution] = useState<ExportResolution>(catalog.defaultResolution);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const activeCatalog = catalog;
  const activeResolution = resolution;
  const cappedNote = null;
  const confirmLabel = 'Export';
  const confirmDisabled = false;
  const confirmShowsPending = false;

  const currentOption =
    activeCatalog.options.find((o) => sameResolution(o.resolution, activeResolution))
    ?? activeCatalog.options[0]!;
  const hasResolutionChoice = activeCatalog.options.length > 1;
  const showVerticalHint = verticalDownscaleApplied
    && sameResolution(activeResolution, catalog.defaultResolution);

  const handleResolutionChange = (id: string) => {
    const option = activeCatalog.options.find((o) => o.id === id);
    if (option) setResolution(option.resolution);
  };

  const handleConfirm = () => {
    const options = { format, quality, resolution: activeResolution };
    return onConfirm(options);
  };

  return (
    <div className="flex flex-col gap-4">
      {hasResolutionChoice ? (
        <ResolutionField
          options={activeCatalog.options}
          currentId={currentOption.id}
          showVerticalHint={showVerticalHint}
          cappedNote={cappedNote}
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


      <ExportSettingsFooter
        alternateLabel="Export captions instead"
        confirmLabel={confirmLabel}
        confirmDisabled={confirmDisabled}
        confirmShowsPending={confirmShowsPending}
        onAlternate={onSwitchToOtherFormats}
        onCancel={onCancel}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

