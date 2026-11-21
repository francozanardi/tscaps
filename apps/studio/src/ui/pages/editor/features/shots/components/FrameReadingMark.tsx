import { Loader2 } from 'lucide-react';

/** A small spinner in the corner of a frame of the video, while a newer frame is read for it. */
export function FrameReadingMark() {
  return (
    <span role="status" aria-label="Loading the frame" className="absolute bottom-1 right-1 z-20 flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white pointer-events-none">
      <Loader2 size={12} className="animate-spin" aria-hidden />
    </span>
  );
}
