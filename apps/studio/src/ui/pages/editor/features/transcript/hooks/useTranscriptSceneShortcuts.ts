import type { SegmentTextareaFocuser } from '@presentation/editor/services/SegmentTextareaFocuser';
import type { SortedEntry } from '@ui/pages/editor/features/transcript/components/TranscriptPanel';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { useShortcut } from '@ui/_shared/hooks/useShortcut';

interface TranscriptSceneShortcutsParams {
  /** The scenes in the order the transcript lists them. */
  sorted: SortedEntry[];
  activeSegmentId: string | null;
  textareaFocus: SegmentTextareaFocuser;
  scrollTo: (segmentId: string) => void;
  enabled: boolean;
}

/**
 * Carries out the transcript's scene commands: stepping to the previous
 * or next scene, and playing from the start of a scene.
 *
 * "The scene" is the one whose text is being edited, or, with no text
 * focused, the one under the playhead. Stepping lands on the neighbour
 * in the transcript's order: the playhead moves into it, where a click
 * on the scene would put it, the list scrolls to it, and its text takes
 * focus with the caret at the end, so a correction can start typing at
 * once. Past the first or last scene a
 * step does nothing and leaves the keystroke to the text field.
 */
export function useTranscriptSceneShortcuts(params: TranscriptSceneShortcutsParams): void {
  const { sorted, activeSegmentId, textareaFocus, scrollTo, enabled } = params;
  const playback = usePlayback();

  const currentIndex = (): number => {
    const currentId = textareaFocus.focusedSegmentId() ?? activeSegmentId;
    return sorted.findIndex((entry) => entry.segment.id === currentId);
  };

  const editSceneAt = (index: number): boolean => {
    const target = sorted[index];
    if (!target) return false;
    playback.seek(target.segment.time.midpoint);
    scrollTo(target.segment.id);
    textareaFocus.focusWhenRendered(target.segment.id);
    return true;
  };

  const step = (direction: -1 | 1): boolean => {
    const index = currentIndex();
    if (index < 0) return editSceneAt(direction > 0 ? 0 : sorted.length - 1);
    return editSceneAt(index + direction);
  };

  const playScene = (): boolean => {
    const scene = sorted[currentIndex()];
    if (!scene) return false;
    playback.seek(scene.segment.time.start);
    playback.play();
    return true;
  };

  useShortcut('transcript.previousScene', () => step(-1), enabled);
  useShortcut('transcript.nextScene', () => step(1), enabled);
  useShortcut('transcript.playScene', playScene, enabled);
}
