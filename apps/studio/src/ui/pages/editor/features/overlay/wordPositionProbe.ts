import type { AlignmentConfig } from '@tscaps/engine';

export interface WordAnchorFraction {
  readonly verticalOffset: number;
  readonly horizontalOffset: number;
}

/** Anchor point of the word on-screen as a fraction of the video frame. Edge is picked by `alignment` so committing this value pins the word where it already sits — no visual jump on first slider tick. `null` when the word is not currently rendered. */
export function measureWordAnchorFraction(
  wordId: string,
  alignment: AlignmentConfig,
): WordAnchorFraction | null {
  const escapedId = CSS.escape(wordId);
  const wordEl = document.querySelector<HTMLElement>(
    `.subtitle-overlay-scaler [data-tscaps-word-id="${escapedId}"]`,
  );
  if (!wordEl) return null;
  const scaler = wordEl.closest<HTMLElement>('.subtitle-overlay-scaler');
  if (!scaler) return null;

  const wordRect = wordEl.getBoundingClientRect();
  const scalerRect = scaler.getBoundingClientRect();
  if (scalerRect.width === 0 || scalerRect.height === 0) return null;

  const anchorY =
    alignment.verticalAlign === 'top' ? wordRect.top :
    alignment.verticalAlign === 'bottom' ? wordRect.bottom :
    wordRect.top + wordRect.height / 2;
  const anchorX =
    alignment.horizontalAlign === 'left' ? wordRect.left :
    alignment.horizontalAlign === 'right' ? wordRect.right :
    wordRect.left + wordRect.width / 2;

  return {
    verticalOffset: (anchorY - scalerRect.top) / scalerRect.height,
    horizontalOffset: (anchorX - scalerRect.left) / scalerRect.width,
  };
}
