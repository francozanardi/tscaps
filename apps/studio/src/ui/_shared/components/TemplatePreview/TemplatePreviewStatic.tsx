import { useMemo } from 'react';
import type { Template } from '@core/templates/domain/Template';
import type { DecorationPlacementSide, WordSplitter } from '@tscaps/engine';
import { TemplatePreviewMock } from '@presentation/editor/services/TemplatePreviewMock';
import { TemplatePreviewCaption } from '@ui/_shared/components/TemplatePreview/TemplatePreviewCaption';

const previewMock = new TemplatePreviewMock();

interface TemplatePreviewStaticProps {
  template: Template;
  letterSplitter: WordSplitter | null;
  emojiSide: DecorationPlacementSide | null;
}

/**
 * Resting frame of the preview, rendered while the card is not hovered:
 * the caption the template declares for its tile, or its name as one
 * word being said.
 */
export function TemplatePreviewStatic({ template, letterSplitter, emojiSide }: TemplatePreviewStaticProps) {
  const letterMode = letterSplitter !== null;
  const caption = useMemo(
    () => (template.tile
      ? previewMock.tileCaption(template.tile, letterMode)
      : previewMock.nameCaption(template.metadata.name, letterMode)),
    [template, letterMode],
  );
  return (
    <TemplatePreviewCaption
      caption={caption}
      time={caption.restTime}
      letterSplitter={letterSplitter}
      emojiSide={emojiSide}
    />
  );
}
