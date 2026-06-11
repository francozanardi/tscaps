export interface PlaybackActions {
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  setPlaybackRate: (rate: number) => void;
  prevFrame: () => void;
  nextFrame: () => void;
  prevWord: () => void;
  nextWord: () => void;
  prevSegment: () => void;
  nextSegment: () => void;
}
