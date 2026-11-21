import { useCallback, useMemo } from 'react';
import { ShotTransitionReplayRangeResolver } from '@presentation/shots/services/ShotTransitionReplayRangeResolver';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { useRangeReplay } from '@ui/pages/editor/features/element/useRangeReplay';

/**
 * Plays the transition into the shot `shotId` once, with a moment of
 * either shot around it, with its sound: a cut is judged as it will be
 * heard. It starts early enough to take in the sounds placed on the cut:
 * the transition's, its camera's, and those on the shot's start. Does nothing while the user is
 * playing the video, or where the shot has no transition. The shots are
 * read when it is called, so a transition just picked is what plays.
 */
export function useShotTransitionReplay(shotId: string): () => void {
  const store = useEditor().store;
  const timeMap = useRenderTimeMap();
  const replayRange = useRangeReplay();
  const resolver = useMemo(() => new ShotTransitionReplayRangeResolver(), []);

  return useCallback(() => {
    const { shots, video, audio } = store.snapshot();
    const onCut = audio.clips().filter(({ role, start }) => role === 'effect'
      && (start.anchor.kind === 'transition' || start.anchor.kind === 'camera'
        || (start.anchor.kind === 'shot' && start.anchor.edge === 'start'))
      && start.anchor.shotId === shotId);
    const leadSec = Math.max(0, ...onCut.map(({ start }) => -start.offsetSec));
    const range = resolver.resolve(shotId, shots, timeMap, video.duration, leadSec);
    if (range !== null) replayRange(range.startSec, range.endSec, true);
  }, [store, resolver, shotId, timeMap, replayRange]);
}
