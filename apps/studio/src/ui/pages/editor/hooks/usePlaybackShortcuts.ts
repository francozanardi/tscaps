import type { RefObject } from 'react';
import type { VideoController } from '@presentation/editor/controllers/VideoController';
import { useShortcut } from '@ui/_shared/hooks/useShortcut';

const VOLUME_STEP = 0.1;

/**
 * Carries out the playback commands on the editor's video for as long
 * as the editor is mounted. The controller is read through the ref at
 * the moment of the keystroke, since the video element it wraps can be
 * replaced under a mounted editor.
 */
export function usePlaybackShortcuts(controllerRef: RefObject<VideoController | null>): void {
  useShortcut('playback.toggle', () => controllerRef.current?.togglePlay());
  useShortcut('playback.play', () => controllerRef.current?.play());
  useShortcut('playback.pause', () => controllerRef.current?.pause());
  useShortcut('playback.previousFrame', () => controllerRef.current?.prevFrame());
  useShortcut('playback.nextFrame', () => controllerRef.current?.nextFrame());
  useShortcut('playback.previousWord', () => controllerRef.current?.prevWord());
  useShortcut('playback.nextWord', () => controllerRef.current?.nextWord());
  useShortcut('playback.previousScene', () => controllerRef.current?.prevSegment());
  useShortcut('playback.nextScene', () => controllerRef.current?.nextSegment());
  useShortcut('playback.volumeUp', () => changeVolume(controllerRef.current, VOLUME_STEP));
  useShortcut('playback.volumeDown', () => changeVolume(controllerRef.current, -VOLUME_STEP));
  useShortcut('playback.slower', () => controllerRef.current?.changePlaybackRate(-1));
  useShortcut('playback.faster', () => controllerRef.current?.changePlaybackRate(1));
}

function changeVolume(controller: VideoController | null, delta: number): void {
  controller?.setVolume(controller.currentVolume() + delta);
}
