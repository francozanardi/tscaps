import { memo, useEffect, useMemo, useState } from 'react';
import type { Graphic } from '@core/graphics/domain/Graphic';
import { CustomGraphicPresetBuilder } from '@presentation/graphics/services/CustomGraphicPresetBuilder';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { GraphicPresetCard } from '@ui/pages/editor/features/graphics/components/GraphicPresetCard';

interface CustomGraphicCardProps {
  graphic: Graphic;
  onPick: () => void;
}

/**
 * A graphic that is no preset, as it is: a card picked already, its
 * thumbnail the graphic's code with its fields' defaults, recorded again
 * when the code changes; the thumbnail it no longer shows is given back.
 */
export const CustomGraphicCard = memo(function CustomGraphicCard({ graphic, onPick }: CustomGraphicCardProps) {
  const { graphicPresetThumbnails } = useShots().services;
  const [builder] = useState(() => new CustomGraphicPresetBuilder());
  const preset = useMemo(() => builder.presetOf(graphic), [builder, graphic]);
  useEffect(() => () => graphicPresetThumbnails.release(preset.id), [graphicPresetThumbnails, preset.id]);
  return <GraphicPresetCard preset={preset} picked onPick={onPick} />;
});
