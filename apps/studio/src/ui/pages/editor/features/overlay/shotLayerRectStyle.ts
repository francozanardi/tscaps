import type { CSSProperties } from 'react';
import type { FootageRect } from '@tscaps/engine/advanced';

/** A rect normalized to the frame, laid on the overlay scaler, which covers the frame exactly. */
export function shotLayerRectStyle(rect: FootageRect): CSSProperties {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}
