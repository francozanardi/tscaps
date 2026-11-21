import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePreviewStreams } from '@ui/_shared/contexts/PreviewStreamsContext';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { usePreview } from '@ui/_shared/contexts/modules/PreviewContext';

interface PersistentVideoFrame {
  /** The video's own picture, then the inserted footage's over it, in paint order. */
  readonly elements: readonly HTMLVideoElement[];
  /** Move the elements back to the provider's hidden warehouse. */
  park(): void;
}

interface MirrorElements {
  readonly video: HTMLVideoElement;
  readonly footage: HTMLVideoElement;
}

const PersistentVideoFrameContext = createContext<PersistentVideoFrame | null>(null);

export const usePersistentVideoFrame = (): PersistentVideoFrame | null =>
  useContext(PersistentVideoFrameContext);

interface ProviderProps {
  readonly children: ReactNode;
}

const WAREHOUSE_STYLE = { display: 'none' } as const;

/**
 * Maintains two detached `<video srcObject>` elements for the lifetime
 * of the overlay, mirroring the preview: one plays the video's own
 * picture, the other the footage inserted over it, and is visible only
 * while footage covers the picture — flipped on the surface's own
 * event, not on a render. Consumers borrow both via
 * `usePersistentVideoFrame` and reparent them into their own DOM; when
 * no consumer holds them they rest in a hidden warehouse so the
 * streams keep playing. This avoids the one-frame black flash that a
 * per-segment mount of `<video>` produced between adjacent segments.
 */
export function PersistentVideoFrameProvider({ children }: ProviderProps) {
  const streams = usePreviewStreams();
  const surface = usePreview().surface;
  const { constants } = useEngine();
  const warehouseRef = useRef<HTMLDivElement | null>(null);
  const mirrorRef = useRef<MirrorElements | null>(null);
  const [contextValue, setContextValue] = useState<PersistentVideoFrame | null>(null);

  useLayoutEffect(() => {
    const warehouse = warehouseRef.current;
    if (!warehouse) return;
    const video = createVideoElement(constants.VIDEO_FRAME_LAYER_CLASS);
    const footage = createVideoElement(constants.VIDEO_FRAME_LAYER_CLASS);
    mirrorRef.current = { video, footage };
    warehouse.append(video, footage);
    const park = () => {
      if (video.parentElement !== warehouse || footage.parentElement !== warehouse) warehouse.append(video, footage);
    };
    setContextValue({ elements: [video, footage], park });
    return () => {
      video.remove();
      footage.remove();
      mirrorRef.current = null;
      setContextValue(null);
    };
  }, [constants.VIDEO_FRAME_LAYER_CLASS]);

  useEffect(() => {
    const mirror = mirrorRef.current;
    if (!mirror) return;
    playStream(mirror.video, streams?.video ?? null);
    playStream(mirror.footage, streams?.footage ?? null);
  }, [streams, contextValue]);

  useEffect(() => {
    const footage = mirrorRef.current?.footage;
    if (!footage) return;
    const update = () => showOnlyWhile(footage, surface.isShowingFootage());
    update();
    surface.addEventListener('footagechange', update);
    return () => surface.removeEventListener('footagechange', update);
  }, [surface, contextValue]);

  return (
    <PersistentVideoFrameContext.Provider value={contextValue}>
      <div ref={warehouseRef} style={WAREHOUSE_STYLE} aria-hidden />
      {children}
    </PersistentVideoFrameContext.Provider>
  );
}

function playStream(element: HTMLVideoElement, stream: MediaStream | null): void {
  element.srcObject = stream;
  if (stream) element.play().catch(() => {});
}

function showOnlyWhile(element: HTMLVideoElement, showing: boolean): void {
  element.style.visibility = showing ? 'visible' : 'hidden';
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
