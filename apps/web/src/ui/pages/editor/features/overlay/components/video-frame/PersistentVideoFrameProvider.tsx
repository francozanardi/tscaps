import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useMainVideoStream } from '@ui/_shared/contexts/MainVideoStreamContext';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';

interface PersistentVideoFrame {
  readonly element: HTMLVideoElement;
  /** Move the element back to the provider's hidden warehouse. */
  park(): void;
}

const PersistentVideoFrameContext = createContext<PersistentVideoFrame | null>(null);

export const usePersistentVideoFrame = (): PersistentVideoFrame | null =>
  useContext(PersistentVideoFrameContext);

interface ProviderProps {
  readonly children: ReactNode;
}

const WAREHOUSE_STYLE = { display: 'none' } as const;

/**
 * Maintains one detached `<video srcObject>` element for the lifetime
 * of the overlay. Consumers borrow it via `usePersistentVideoFrame`
 * and reparent it into their own DOM; when no consumer holds it the
 * element rests in a hidden warehouse so the underlying stream keeps
 * playing. This avoids the one-frame black flash that a per-segment
 * mount of `<video>` produced between adjacent segments.
 */
export function PersistentVideoFrameProvider({ children }: ProviderProps) {
  const stream = useMainVideoStream();
  const { constants } = useEngine();
  const warehouseRef = useRef<HTMLDivElement | null>(null);
  const elementRef = useRef<HTMLVideoElement | null>(null);
  const [contextValue, setContextValue] = useState<PersistentVideoFrame | null>(null);

  useLayoutEffect(() => {
    const warehouse = warehouseRef.current;
    if (!warehouse) return;
    const element = createVideoElement(constants.VIDEO_FRAME_LAYER_CLASS);
    elementRef.current = element;
    warehouse.appendChild(element);
    const park = () => {
      if (element.parentElement !== warehouse) warehouse.appendChild(element);
    };
    setContextValue({ element, park });
    return () => {
      element.remove();
      elementRef.current = null;
      setContextValue(null);
    };
  }, [constants.VIDEO_FRAME_LAYER_CLASS]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    element.srcObject = stream;
    if (stream) element.play().catch(() => {});
  }, [stream, contextValue]);

  return (
    <PersistentVideoFrameContext.Provider value={contextValue}>
      <div ref={warehouseRef} style={WAREHOUSE_STYLE} aria-hidden />
      {children}
    </PersistentVideoFrameContext.Provider>
  );
}

function createVideoElement(className: string): HTMLVideoElement {
  const element = document.createElement('video');
  element.className = className;
  element.autoplay = true;
  element.muted = true;
  element.playsInline = true;
  element.setAttribute('aria-hidden', 'true');
  return element;
}
