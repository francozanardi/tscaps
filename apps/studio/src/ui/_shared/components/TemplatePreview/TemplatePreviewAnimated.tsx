import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { DecorationPlacementSide, WordSplitter } from '@tscaps/engine';
import type { Template } from '@core/templates/domain/Template';
import { TemplatePreviewMock } from '@presentation/editor/services/TemplatePreviewMock';
import { TemplatePreviewCaption } from '@ui/_shared/components/TemplatePreview/TemplatePreviewCaption';

const previewMock = new TemplatePreviewMock();

interface TemplatePreviewAnimatedProps {
  template: Template;
  letterSplitter: WordSplitter | null;
  emojiSide: DecorationPlacementSide | null;
  /** Element used to verify the pointer is still over the card each frame. */
  hostRef: RefObject<HTMLElement>;
  /** Called when the rAF detects the pointer left without a `mouseleave`. */
  onHoverLost: () => void;
}

/**
 * Live frame of the preview, mounted only while the card is hovered. Plays
 * the caption the template declares for its tile, or three sample words,
 * on a loop, driving `currentTime` with rAF so the words cycle through
 * their narration states.
 *
 * Each frame checks `hostRef.matches(':hover')` to self-heal if a
 * `mouseleave` event was missed (e.g. a modal opens over the card and the
 * pointer leaves before React notices) — without this, the rAF would tick
 * forever once the parent state desyncs from the actual hover state.
 */
export function TemplatePreviewAnimated({ template, letterSplitter, emojiSide, hostRef, onHoverLost }: TemplatePreviewAnimatedProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const letterMode = letterSplitter !== null;
  const caption = useMemo(
    () => (template.tile ? previewMock.tileCaption(template.tile, letterMode) : previewMock.sampleCaption()),
    [template, letterMode],
  );

  useEffect(() => {
    let startTime: number | null = null;
    let rafId: number;
    const tick = (timestamp: number) => {
      if (hostRef.current && !hostRef.current.matches(':hover')) {
        onHoverLost();
        return;
      }
      if (!startTime) startTime = timestamp;
      setCurrentTime(((timestamp - startTime) / 1000) % caption.duration);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [hostRef, onHoverLost, caption]);

  return (
    <TemplatePreviewCaption
      caption={caption}
      time={currentTime}
      letterSplitter={letterSplitter}
      emojiSide={emojiSide}
    />
  );
}
